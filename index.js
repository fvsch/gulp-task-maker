'use strict'

const fs = require('fs')
const glob = require('glob')
const gulp = require('gulp')
const path = require('path')
const notify = require('./notify.js')
const tools = require('./tasktools.js')
const isObject = obj => obj !== null && typeof obj === 'object'

module.exports = {
  load: loadTasks,
  task: loadSingleTask,
  tools: tools
}

/** @var {Array} maintain a list of already registered scripts */
const KNOWN_SCRIPTS = []

/** @var {Array} maintain a list of already registered tasks */
const REGISTERED_TASKS = []

/** @var {string} usage info for several errors */
const USAGE_INFO = `Expected usage:
const gtm = require('gulp-task-maker')

// set up with the task directory path
gtm.load('path/to/tasks', {
  mytask: { … },
  othertask: { … }
})

// or with more options
gtm.load({
  taskDir: 'path/to/tasks',
  defaultTask: 'build'
}, {
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
 * Resolve the provided tasks directory path and return the createTasks function
 * @param {string|object} options - task directory path or fully-fledged config
 * @param {string} options.taskDir - setup config
 * @param {*} options.defaultTask - value for the 'default' gulp task
 * @param {Object} tasksConfig - tasks config
 */
function loadTasks(options, tasksConfig) {
  const taskDir = isObject(options) ? options.taskDir : options
  const defaultTask = isObject(options) ? options.defaultTask : 'build'
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
    registerGlobalTasks(defaultTask)
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
function loadSingleTask(scriptPath, taskConfig) {
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
  if (KNOWN_SCRIPTS.includes(configName)) {
    showError({
      message: `Tasks already configured for '${configName}'`,
      details: USAGE_REDECLARE
    })
    return
  }
  // remember this (existing) script, even if it fails to load
  KNOWN_SCRIPTS.push(configName)
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
      if (moduleName && knownMissing.includes(moduleName)) {
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
      .forEach(t => REGISTERED_TASKS.push(t))
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
      builder(conf, tools)
    })
    taskNames.push(buildId)

    // Register matching watch task
    if (Array.isArray(conf.watch) && conf.watch.length > 0) {
      gulp.task(watchId, function() {
        gulp.watch(conf.watch, [buildId])
      })
      taskNames.push(watchId)
    }
  })

  return taskNames
}

/**
 * Register gulp tasks 'build', 'watch', and optionally 'default'
 * We might end up calling this several times (especially if using
 * the gulpTaskMaker.task method), but gulp seems to be okay with
 * overwriting a task reference with a new one.
 * @param {*} defaultTask
 */
function registerGlobalTasks(defaultTask) {
  let tasks = REGISTERED_TASKS
  if (tasks.length === 0) return

  // Register or update tasks groups
  gulp.task('build', tasks.filter(s => s.includes('build')))
  gulp.task('watch', tasks.filter(s => s.includes('watch')))

  // Register the default task if defined and valid
  if (typeof defaultTask === 'function') {
    gulp.task('default', defaultTask)
  }
  else if (Array.isArray(defaultTask) && defaultTask.length > 0) {
    gulp.task('default', defaultTask.filter(s => tasks.includes(s)))
  }
  else if (typeof defaultTask === 'string' && tasks.includes(defaultTask)) {
    gulp.task('default', [defaultTask])
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
  if (typeof conf.dest === 'string' && Array.isArray(conf.src) && conf.src.length > 0) {
    return true;
  }
  else {
    showError({
      message: `Invalid '${configName}' config object`,
      details: JSON.stringify(conf, null, 2)
        .replace(/^{\n {2}/, '{ ')
        .replace(/\n}$/, ' }')
    })
    return false
  }
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
