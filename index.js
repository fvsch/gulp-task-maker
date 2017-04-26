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
 * @property {Array} _scripts - maintain a list of known scripts with status info
 * @property {Array} _tasks - maintain a list of already registered tasks
 * @property {Array} _args - the arguments gulp was called with (if we can find them)
 */
const GTM = {
  buildTask: 'build',
  watchTask: 'watch',
  defaultTask: true,
  _scripts: {},
  _tasks: [],
  _args: getGulpArgs()
}

/**
 * Flag to ensure we only show the main error report once
 * @type {boolean}
 */
let setupErrorsShown = false

/**
 * Changes to config after the gulpTaskMaker.load or gulpTaskMaker.task
 * methods have been used would not affect those early uses, and make things
 * inconsistent.
 * @var {boolean}
 */
let lockConfig = false

/**
 * Populate a list of 'src' patterns that we can check later on when
 * displaying the tasks status summary (using glob.sync)
 * @type {Array}
 */
const sourcePatterns = []

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
      message: `load: missing taskDir option`,
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
        message: `load: taskDir doesn’t exist`,
        details: `No such directory: ${dir}`
      })
    }
  }

  if (!isObject(tasksConfig)) {
    showError({
      message: 'load: missing task config object',
      details: USAGE_INFO
    })
  }

  if (realDir && isObject(tasksConfig)) {
    // register tasks
    for (const key of Object.keys(tasksConfig)) {
      registerTask(key, path.join(realDir, key + '.js'), tasksConfig[key])
    }
    registerGlobalTasks()
    // display errors (if not running a global task)
    const mode = getRunningMode()
    if (mode === 'tasks' || mode === '') {
      showLoadingErrors()
    }
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
      message: `task: first argument must be a string`,
      details: USAGE_INFO
    })
  }
  if (!isObject(taskConfig)) {
    throw showError({
      message: 'task: missing task config object',
      details: USAGE_INFO
    })
  }
  const script = path.isAbsolute(scriptPath)
    ? path.normalize(scriptPath)
    : path.join(process.cwd(), scriptPath)
  const key = path.basename(script, '.js')

  // register tasks
  registerTask(key, script, taskConfig)
  registerGlobalTasks()
  // display errors (if not running a global task)
  const mode = getRunningMode()
  if (mode === 'tasks' || mode === '') {
    showLoadingErrors()
  }
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
  const info = {
    path: scriptPath,
    exists: false,
    sources: [],
    errors: [],
    missingDeps: [],
  }
  if (configName in GTM._scripts) {
    showError({
      message: `Tasks already configured for '${configName}'`,
      details: USAGE_REDECLARE
    })
    return
  }
  if (fs.existsSync(scriptPath)) {
    info.exists = true
    let builder = null
    try {
      builder = require(scriptPath)
    }
    catch(err) {
      // always check dependencies if a task failed, even if the error was different
      info.missingDeps = checkDependencies(scriptPath)
      // do nothing more if the error was about a documented dependency
      let module = null
      if (err.code === 'MODULE_NOT_FOUND' && typeof err.message === 'string') {
        module = (err.message.match(/module '(.*)'/) || [null,null])[1]
      }
      if (typeof module !== 'string' || module in info.missingDeps === false) {
        info.errors.push(err)
      }
    }
    // save script info
    GTM._scripts[configName] = info
    // register and remember tasks
    if (builder) {
      registerTaskSet(configName, userConfig, builder).forEach(t => {
        GTM._tasks.push(t)
      })
    }
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

    // save normalized sources, to be checked later
    GTM._scripts[key].sources = conf.src

    // Register build task
    gulp.task(buildId, () => builder(conf, taskTools))
    taskNames.push(buildId)

    // Register matching watch task
    if (Array.isArray(conf.watch) && conf.watch.length > 0) {
      gulp.task(watchId, () => gulp.watch(conf.watch, [buildId]))
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
  let tasks = GTM._tasks

  // push task name to the start of the list
  const remember = name => {
    if (GTM._tasks.indexOf(name) === -1) {
      GTM._tasks = [name].concat(GTM._tasks)
    }
  }

  // Register or update tasks groups
  if (GTM.watchTask) {
    const watchers = tasks.filter(s => s.indexOf('watch') === 0)
    gulp.task(GTM.watchTask, watchers, function(){
      if (watchers.length === 0) showError({
        warn: true, message: 'No watch tasks found'
      })
      showLoadingErrors()
    })
    remember(GTM.watchTask)
  }
  if (GTM.buildTask) {
    const builders = tasks.filter(s => s.indexOf('build') === 0)
    gulp.task(GTM.buildTask, builders, function() {
      if (builders.length === 0) showError({
        warn: true, message: 'No build tasks found'
      })
      showLoadingErrors()
    })
    remember(GTM.buildTask)
  }
  // Register the default task if defined and valid
  if (GTM.defaultTask === true && GTM.buildTask) {
    gulp.task('default', [GTM.buildTask])
    remember('default')
  }
  else if (typeof GTM.defaultTask === 'function') {
    gulp.task('default', function(){
      showLoadingErrors()
      return GTM.defaultTask()
    })
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
 * Take the user's task config (which can be a single object,
 * or an array of config objects), and return an array of complete
 * and normalized config objects.
 * @param {string} configName
 * @param {Object|Array} userConfig
 * @returns {Array}
 */
function normalizeUserConfig(configName, userConfig) {
  if (!isObject(userConfig)) {
    GTM._scripts[configName].errors.push({
      message: `Invalid config object for '${configName}'.\n` +
        'Expected an array or object; received a ' + typeof userConfig
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
  let errors = []
  if (typeof conf.dest !== 'string') {
    errors.push('\'dest\' property must be a string')
  }
  if (!Array.isArray(conf.src) || conf.src.length === 0) {
    errors.push('\'src\' property is empty')
  }
  if (errors.length === 0) {
    return true
  }
  // build a flatter version than JSON.stringify only
  const printable = []
  for (const key of Object.keys(conf)) {
    let value = JSON.stringify(conf[key],null,0)
    printable.push(`"${key}": ${value}`)
  }
  // save error for displaying later
  GTM._scripts[configName].errors.push({
    message: `Invalid config object for '${configName}'\n${
      errors.join('\n')
    }\n{ ${
      printable.join(',\n  ')  
    } }`
  })
  return false
}

/**
 * Load a task's JSON file with dependencies, try loading each dependency
 * and log the missing deps with instructions on how to install.
 * Note: we are NOT resolving version conflicts of any kind.
 * @param {string} scriptPath
 * @return {object} missing dependencies' spec (name and version)
 */
function checkDependencies(scriptPath) {
  let dependencies = {}
  const missing = {}
  try {
    const json = require(scriptPath.replace(/\.js$/, '.json')).dependencies || {}
    if (isObject(json)) dependencies = json
  }
  catch(e) {}
  for (const key of Object.keys(dependencies)) {
    try { require(key) }
    catch(e) { if (e.code === 'MODULE_NOT_FOUND') missing[key] = dependencies[key] }
  }
  return missing
}

/**
 * Show errors which occurred when first loading a task's script.
 * - The GTM._missingDependencies map is populated when loading each script
 * - Then at the end of the 'build' and 'watch' tasks, we show this recap
 *   with instructions on how to install all missing dependencies at once.
 */
function showLoadingErrors() {
  if (setupErrorsShown) {
    return
  }
  let failedCount = 0
  const taskStatus = {}
  const missingDependencies = []

  // Construct data for full report
  for (const key of Object.keys(GTM._scripts)) {
    const info = GTM._scripts[key]
    const deps = Object.keys(info.missingDeps)
    // prepare task-specific message
    const messages = []
    if (!info.exists) {
      messages.push('✘ Could not find task script')
    }
    if (deps.length !== 0) {
      messages.push('✘ Missing dependencies: ' + deps.join(', '))
    }
    for (const src of info.sources) {
      const found = glob.sync(src)
      if (found.length === 0) {
        messages.push('✘ Missing source file(s): ' + src)
      }
    }
    for (const error of info.errors) {
      let msg = error.message || error.toString()
      let stack = error.stack || error.stackTrace
      if (typeof stack === 'string') {
        if (stack.indexOf(msg)) msg = stack
        else msg = msg + '\n' + stack
      }
      messages.push(
        '✘ ' + (msg.startsWith('Error') ? '' : 'Error: ') +
        msg.replace(/\n/g, '\n  ')
      )
    }
    if (messages.length !== 0) {
      failedCount++
    }
    taskStatus[key] = [
      (info.exists ? '✔︎ ' : '✘ ') + info.path
    ].concat(messages)
    // prepare missing info for the npm install prompt
    for (const name of deps) {
      missingDependencies.push(name + '@' + info.missingDeps[name])
    }
  }

  if (failedCount) {
    const taskMsg = []
    for (const key of Object.keys(taskStatus)) {
      taskMsg.push(`[${key}]\n  ${
        taskStatus[key].join('\n').replace(/\n/g, '\n  ')
      }`)
    }
    let fullMsg = taskMsg.join('\n')
    if (missingDependencies.length !== 0) {
      fullMsg += '\n\nInstall missing task dependencies with:\n' +
        '  npm install -D "' + missingDependencies.join('" "') + '"\n'
    }
    showError({
      message: `Error(s) in ${failedCount} configured task${failedCount > 1 ? 's' : ''}`,
      details: fullMsg
    })
    // only set this flag if we have already shown some errors
    setupErrorsShown = true
  }
}

/**
 * Try to find the arguments used with gulp
 * @return {Array}
 */
function getGulpArgs() {
  // try to find the arguments used with gulp
  const gulpArgs = []
  if (Array.isArray(process.argv)) {
    let found = false
    for (const arg of process.argv) {
      if (found) {
        gulpArgs.push(arg)
      } else {
        found = arg === 'gulp' || /[\\\/]gulp(\.js)?$/.test(arg)
      }
    }
  }
  return gulpArgs
}

/**
 * Check if we’re running Gulp for a 'global' task,
 * which includes the build and watch task, the default task,
 * and the --tasks option.
 * @return {string}
 */
function getRunningMode() {
  if (GTM._args.indexOf(GTM.buildTask) !== -1) return 'build'
  if (GTM._args.indexOf(GTM.watchTask) !== -1) return 'watch'
  if (GTM._args.indexOf('--tasks') !== -1) return 'tasks'
  return ''
}
