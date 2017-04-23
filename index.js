'use strict'

const fs = require('fs')
const glob = require('glob')
const gulp = require('gulp')
const path = require('path')
const notify = require('./notify.js')
const taskTools = require('./tasktools.js')
const isObject = obj => obj !== null && typeof obj === 'object'

// Export the configuration
module.exports = {
  config: configureTaskMaker,
  load: loadTasks,
  task: loadSingle,
  tools: taskTools
}

/**
 * gulp-task-maker state
 * @var {object}
 * @property {string} taskDir - relative path to tasks directory
 * @property {string|boolean} buildTask - name to use for the global 'build' task
 * @property {string|boolean} watchTask - name to use for the global 'watch' task
 * @property {*} defaultTask - value to use (string, array, function…) for the 'default' task
 * @property {Array} _knownScripts - maintain a list of already registered scripts
 * @property {Array} _registeredTasks - maintain a list of already registered tasks
 */
const GTM = {
  buildTask: 'build',
  watchTask: 'watch',
  defaultTask: true,
  _knownScripts: [],
  _registeredTasks: [],
}

/**
 * Changes to config after the gulpTaskMaker.load or gulpTaskMaker.task
 * methods have been used would not affect those early uses, and make things
 * inconsistent.
 * @var {boolean}
 */
let lockConfig = false

/** @var {string} usage info for several errors */
const USAGE_INFO = `Expected usage:
const gtm = require('gulp-task-maker')

// set up with the task directory path
gtm.load('path/to/tasks', {
  mytask: { … },
  othertask: { … }
})

// or set up a single task
gtm.task('path/to/tasks/something.js', { … })
`

/** @var {string} usage info for redeclared tasks */
const USAGE_REDECLARE = `This error happens when you’re trying to configure the same task several times with gulp-task-maker. Make sure you are not redeclaring the same task script.

// Usage for declaring a script with several builds:
const gtm = require('gulp-task-maker')

// bad, will fail!
gtm.task('path/to/mytask.js', { src: 'foo/*.js', dest: 'dist/foo.js' })
gtm.task('path/to/mytask.js', { src: 'bar/*.js', dest: 'dist/bar.js' })

// do this instead:
gtm.task('path/to/mytask.js', [
  { src: 'foo/*.js', dest: 'dist/foo.js' },
  { src: 'bar/*.js', dest: 'dist/bar.js' }
])
`

/**
 * Allows users to override default configuration
 * @param {object|undefined} config - options, or undefined to return the current config
 * @param {string|boolean} config.buildTask - name to use for the main build task, false to disable
 * @param {string|boolean} config.watchTask - name to use for the main watch task, false to disable
 * @param {*} config.defaultTask - value for the default task, false to disable
 * @returns {object} Current config
 */
function configureTaskMaker(config) {
  if (isObject(config)) {
    if (lockConfig === true) {
      throw showError({
        message: 'gulp-task-maker configuration cannot be changed at this point',
        details: 'The `gulpTaskMaker.config` method cannot be called after any use of `gulpTaskMaker.load` or `gulpTaskMaker.task`.'
      })
    }
    if (typeof config.buildTask === 'string' || config.buildTask === false) {
      GTM.buildTask = config.buildTask
    }
    if (typeof config.watchTask === 'string' || config.watchTask === false) {
      GTM.watchTask = config.watchTask
    }
    if (typeof config.defaultTask !== 'undefined') {
      GTM.defaultTask = config.defaultTask
    }
  }
  return GTM
}

/**
 * Resolve the provided tasks directory path and return the createTasks function
 * @param {string} taskDir - task directory path or fully-fledged config
 * @param {Object} tasksConfig - tasks config
 */
function loadTasks(taskDir, tasksConfig) {
  lockConfig = true
  let realDir = null
  if (typeof taskDir !== 'string') {
    showError({
      message: `gulpTaskMaker.load: missing taskDir option`,
      details: USAGE_INFO
    })
  }
  else {
    const dir = path.isAbsolute(taskDir)
      ? path.normalize(taskDir)
      : path.join(process.cwd(), taskDir)
    if (fs.existsSync(dir)) {
      realDir = dir
    }
    else {
      showError({
        message: `gulpTaskMaker.load: taskDir doesn’t exist`,
        details: `No such directory: ${dir}`
      })
    }
  }

  if (!isObject(tasksConfig)) {
    showError({
      message: 'gulpTaskMaker.load: missing task config object',
      details: USAGE_INFO
    })
  }

  if (realDir && isObject(tasksConfig)) {
    // register individual tasks
    for (const key of Object.getOwnPropertyNames(tasksConfig)) {
      registerTask(key, path.join(realDir, key + '.js'), tasksConfig[key])
    }
    // register 'build', 'watch' and 'default' tasks
    registerGlobalTasks()
  }
  else {
    process.exitCode = 1
  }
}

/**
 * Create a single task (public method, defers to createTask)
 * @param {string} scriptPath
 * @param {object} taskConfig
 */
function loadSingle(scriptPath, taskConfig) {
  lockConfig = true
  if (typeof scriptPath !== 'string') {
    throw showError({
      message: `gulpTaskMaker.task: first argument must be a string`,
      details: USAGE_INFO
    })
  }
  if (!isObject(taskConfig)) {
    throw showError({
      message: 'gulpTaskMaker.task: missing task config object',
      details: USAGE_INFO
    })
  }
  const script = path.isAbsolute(scriptPath)
    ? path.normalize(scriptPath)
    : path.join(process.cwd(), scriptPath)
  const key = path.basename(script, '.js')

  // defer to createTask to actually load the script and register tasks
  registerTask(key, script, taskConfig)
  registerGlobalTasks()
}

/**
 * Load a task script and create the related gulp tasks (based on provided config).
 * This function mostly does validation of input data, and defers to registerTaskSet.
 * Side effects:
 * - adds the script path to
 * @param {string} configName
 * @param {string} scriptPath
 * @param {object} userConfig
 */
function registerTask(configName, scriptPath, userConfig) {
  if (!fs.existsSync(scriptPath)) {
    showError({
      message: `No script found for '${configName}' task(s)`,
      details: `File not found: ${scriptPath}`
    })
    return
  }
  if (GTM._knownScripts.indexOf(configName) !== -1) {
    showError({
      message: `Tasks already configured for '${configName}'`,
      details: USAGE_REDECLARE
    })
    return
  }
  // remember this (existing) script, even if it fails to load
  GTM._knownScripts.push(configName)
  let builder = null
  try {
    builder = require(scriptPath)
  }
  catch(err) {
    let handled = false
    if (err.code === 'MODULE_NOT_FOUND') {
      // print info about missing dependencies
      const knownMissing = checkDependencies(configName, scriptPath)
      // did we alert about that missing dependency already?
      const moduleName = (err.message.match(/module '(.*)'/) || [null,null])[1]
      if (moduleName && knownMissing.indexOf(moduleName) !== -1) {
        handled = true
      }
    }
    if (!handled) {
      showError({ message: err.message || err.toString() })
    }
    return
  }
  // register and remember tasks
  if (builder) {
    registerTaskSet(configName, userConfig, builder)
      .forEach(t => GTM._registeredTasks.push(t))
  }
}

/**
 * Register matching 'build' and 'watch' gulp tasks and return their name
 * @param {string} key - short name of task
 * @param {Array|Object} configs - config object or array of config objects
 * @param {Function} builder - callback that takes a config object
 * @returns {Array} - names of registered tasks
 */
function registerTaskSet(key, configs, builder) {
  const taskNames = []

  normalizeUserConfig(key, configs).forEach(function(conf, index, normalized) {
    const id = key + (normalized.length > 1 ? '-' + index : '')
    const buildId = 'build-' + id
    const watchId = 'watch-' + id

    // Register build task
    gulp.task(buildId, function() {
      // notify about paths or patterns that match no files
      conf.src.forEach(function(pattern) {
        notifyMissingSource(pattern, id)
      })
      // do the actual building
      return builder(conf, taskTools)
    })
    taskNames.push(buildId)

    // Register matching watch task
    if (Array.isArray(conf.watch) && conf.watch.length > 0) {
      gulp.task(watchId, function() {
        return gulp.watch(conf.watch, [buildId])
      })
      taskNames.push(watchId)
    }
  })

  return taskNames
}

/**
 * Register or update gulp tasks 'build', 'watch', and optionally 'default'
 * We might end up calling this several times (especially if using
 * the gulpTaskMaker.task method), but gulp seems to be okay with
 * overwriting a task reference with a new one.
 */
function registerGlobalTasks() {
  let tasks = GTM._registeredTasks
  if (tasks.length === 0) return

  // push task name to the start of the list
  const remember = name => {
    if (GTM._registeredTasks.indexOf(name) === -1) {
      GTM._registeredTasks = [name].concat(GTM._registeredTasks)
    }
  }

  // Register or update tasks groups
  if (GTM.watchTask) {
    gulp.task(GTM.watchTask, tasks.filter(s => s.indexOf('watch') === 0))
    remember(GTM.watchTask)
  }
  if (GTM.buildTask) {
    gulp.task(GTM.buildTask, tasks.filter(s => s.indexOf('build') === 0))
    remember(GTM.buildTask)
  }
  // Register the default task if defined and valid
  if (typeof GTM.defaultTask === true && GTM.buildTask) {
    gulp.task('default', [GTM.buildTask])
    remember('default')
  }
  else if (typeof GTM.defaultTask === 'function') {
    gulp.task('default', GTM.defaultTask)
    remember('default')
  }
  else if (Array.isArray(GTM.defaultTask) && GTM.defaultTask.length > 0) {
    gulp.task('default', GTM.defaultTask)
    remember('default')
  }
  else if (typeof GTM.defaultTask === 'string') {
    gulp.task('default', [GTM.defaultTask])
    remember('default')
  }
}

/**
 * Notify error with gulp-task-maker as the plugin name
 * @param err
 */
function showError(err) {
  return notify(Object.assign({ plugin: 'gulp-task-maker' }, err))
}

/**
 * Check that a glob patterns actually matches at least one file,
 * and notify users otherwise.
 * @param {string} pattern - glob pattern
 * @param {string} taskId
 */
function notifyMissingSource(pattern, taskId) {
  glob(pattern, (err, found) => {
    if (err) {
      showError(typeof err === 'string' ? { message: err } : err)
    }
    else if (found.length === 0) {
      showError({
        warn: true,
        message: `Missing ${taskId} sources: ${pattern}`
      })
    }
  })
}

/**
 * Take the user's task config (which can be a single object,
 * or an array of config objects), and return an array of complete
 * and normalized config objects.
 * @param {string} configName
 * @param {Object|Array} userConfig
 * @returns {Array}
 */
function normalizeUserConfig(configName, userConfig) {
  if (!isObject(userConfig)) {
    showError({
      message: `Invalid config object for '${configName}'`,
      details: `Config type: ${typeof userConfig}`
    })
    return []
  }
  return (Array.isArray(userConfig) ? userConfig : [userConfig])
    // Sanity check
    .filter(isObject)
    // Normalize the src and watch properties
    .map(normalizeSrc)
    // And only keep valid configs objects
    .filter(conf => validateConfig(configName, conf))
}

/**
 * Make sure the 'src' and 'watch' properties of an object are arrays of strings
 * @param {object} conf
 * @returns {object}
 */
function normalizeSrc(conf) {
  const valid = s => typeof s === 'string' && s.trim() !== ''
  const src = [].concat(conf.src).filter(valid)
  const watch = conf.watch === true ? src : [].concat(conf.watch).filter(valid)
  conf.src = src
  conf.watch = watch
  return conf
}

/**
 * Check that a config object is valid, show an error and drop
 * that config otherwise.
 * @param {string} configName
 * @param {object} conf
 * @returns {boolean}
 */
function validateConfig(configName, conf) {
  let error = ''
  if (typeof conf.dest !== 'string') {
    error += 'Error: \'dest\' property must be a string.\n'
  }
  if (!Array.isArray(conf.src) || conf.src.length === 0) {
    error += 'Error: \'src\' property is empty\n'
  }
  if (error === '') {
    return true
  }
  // build a flatter version than JSON.stringify only
  const printable = []
  for (const key of Object.getOwnPropertyNames(conf)) {
    let value = JSON.stringify(conf[key],null,0)
    printable.push(`  "${key}": ${value}`)
  }
  showError({
    message: `Invalid config object for '${configName}'`,
    details: error + '{\n' + printable.join(',\n') + '\n}'
  })
  return false
}

/**
 * Load a task's JSON file with dependencies, try loading each dependency
 * and log the missing deps with instructions on how to install.
 * Note: we are NOT resolving version conflicts of any kind.
 * @param {string} configName
 * @param {string} scriptPath
 * @return {Array} missing dependencies' names
 */
function checkDependencies(configName, scriptPath) {
  const missing = []
  let deps = {}
  try { deps = require(scriptPath.replace(/\.js$/, '.json')).dependencies || {} }
  catch(e) {}
  for (const key of Object.getOwnPropertyNames(deps)) {
    try { require(key) }
    catch(err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        missing.push({name: key, version: deps[key]})
      }
    }
  }
  // Print information we found
  if (missing.length !== 0) {
    const installList = missing.map(m => `"${m.name}@${m.version}"`).join(' ')
    showError({
      message: `Missing dependencies for '${configName}'`,
      details: `Install with: npm install -D ${installList}\n`
    })
  }
  return missing.map(m => m.name)
}
