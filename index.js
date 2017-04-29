'use strict'

const fs = require('fs')
const glob = require('glob')
const gulp = require('gulp')
const path = require('path')
const notify = require('./notify.js')
const taskTools = require('./tasktools.js')

/**
 * @var {object} _conf - gulp-task-maker options
 * @property {boolean} debug - whether to throw errors or log them after the fact
 * @property {string|boolean} buildTask - name to use for the global 'build' task
 * @property {string|boolean} watchTask - name to use for the global 'watch' task
 * @property {*} defaultTask - value to use (string, array, function…) for the 'default' task
 */
const _conf = {}

/**
 * Boolean flags to lock some features
 * @type {object}
 * @property {boolean} errorsShown - ensure we only show the main error report once
 * @property {boolean} optionsLocked - avoid registering the 'build' and 'watch' tasks under several names
 */
const _flags = {
  errorsShown: false,
  optionsLocked: false
}

/**
 * List of known scripts with status info
 * @type {object}
 */
const _scripts = {}

/**
 * List of already registered tasks
 * @type {Array}
 */
const _tasks = []

/**
 * Usage info for several errors
 * @var {string}
 */
const USAGE_INFO = `Expected usage:
const gtm = require('gulp-task-maker')

// set up with the task directory path
gtm.load('path/to/tasks', {
  mytask: { … },
  othertask: { … }
})

// or set up a single task
gtm.task('path/to/tasks/something.js', { … })`

/**
 * Usage info for redeclared tasks
 * @type {string}
 */
const USAGE_REDECLARE = `This error happens when you’re trying to configure
the same task several times with gulp-task-maker.
Make sure you are not redeclaring the same task script.

// Usage for declaring a script with several builds:
const gtm = require('gulp-task-maker')

// bad, will fail!
gtm.task('path/to/mytask.js', { src: 'foo/*.js', dest: 'dist/foo.js' })
gtm.task('path/to/mytask.js', { src: 'bar/*.js', dest: 'dist/bar.js' })

// do this instead:
gtm.task('path/to/mytask.js', [
  { src: 'foo/*.js', dest: 'dist/foo.js' },
  { src: 'bar/*.js', dest: 'dist/bar.js' }
])`

// populate _conf
configure({
  buildTask: 'build',
  watchTask: 'watch',
  defaultTask: true,
  strict: false
})

// export
module.exports = {
  conf: configure,
  info: getDebugInfo,
  load: loadTasks,
  task: loadSingle,
  tools: taskTools,
}

/**
 * Basic workaround for typeof null === 'object'
 * @param obj
 * @returns {boolean}
 */
function isObject(obj) {
  return obj !== null && typeof obj === 'object'
}

/**
 * Store an error for later, log it instantly or throw if groupErrors is false
 * @param {object} err - error object
 * @param {Array} [store] - where to store the error for later
 */
function handleError(err, store) {
  const hasStore = Array.isArray(store)
  if (!err.plugin) err.plugin = 'gulp-task-maker'
  if (_conf.strict) throw err
  else {
    if (hasStore) store.push(err)
    else notify(err)
  }
}

/**
 * Allows users to override default configuration
 * @param {object} [config] - options, or undefined to return the current config
 * @param {string|boolean} [config.buildTask] - name to use for the main build task, false to disable
 * @param {string|boolean} [config.watchTask] - name to use for the main watch task, false to disable
 * @param {*} [config.defaultTask] - value for the default task, false to disable
 * @param {boolean} [config.strict] - throw errors or log them afterwards
 * @return {object}
 */
function configure(config) {
  // make a shallow copy of config, should not contain a reference
  // unless the defaultTask was set to an array, object or function by user
  const copy = () => Object.assign(Object.create(null), _conf)
  if (!isObject(config)) return copy()
  if (_flags.optionsLocked === true) {
    handleError(
      new Error('gulp-task-maker configuration cannot be changed at this point\n' +
      'The `gulpTaskMaker.conf` method cannot be called after any use of `gulpTaskMaker.load` or `gulpTaskMaker.task`.')
    )
    return copy()
  }
  if (typeof config.strict === 'boolean') {
    _conf.strict = config.strict
    const action = config.strict ? 'removeListener' : 'on'
    process[action]('exit', showLoadingErrors)
  }
  if (typeof config.buildTask === 'string' || config.buildTask === false) {
    _conf.buildTask = config.buildTask
  }
  if (typeof config.watchTask === 'string' || config.watchTask === false) {
    _conf.watchTask = config.watchTask
  }
  if (typeof config.defaultTask !== 'undefined') {
    _conf.defaultTask = config.defaultTask
  }
  return copy()
}

/**
 * Resolve the provided tasks directory path and return the createTasks function
 * @param {string} taskDir - task directory path or fully-fledged config
 * @param {Object} tasksConfig - tasks config
 */
function loadTasks(taskDir, tasksConfig) {
  _flags.optionsLocked = true
  if (typeof taskDir !== 'string') {
    return handleError(
      new Error(`load: missing taskDir option\n${USAGE_INFO}`)
    )
  }
  if (!isObject(tasksConfig)) {
    return handleError(
      new Error(`load: missing task config object\n${USAGE_INFO}`)
    )
  }
  const dir = path.isAbsolute(taskDir)
    ? path.normalize(taskDir)
    : path.join(process.cwd(), taskDir)

  if (!fs.existsSync(dir)) {
    return handleError(
      new Error(`load: taskDir doesn’t exist\nNo such directory: ${dir}`)
    )
  }
  // register tasks
  for (const key of Object.keys(tasksConfig)) {
    registerTask(key, path.join(dir, key + '.js'), tasksConfig[key])
  }
  registerGlobalTasks()
}

/**
 * Create a single task (public method, defers to createTask)
 * @param {string} scriptPath
 * @param {object} taskConfig
 */
function loadSingle(scriptPath, taskConfig) {
  _flags.optionsLocked = true
  if (typeof scriptPath !== 'string') {
    return handleError(
      new Error(`task: first argument must be a string\n${USAGE_INFO}`)
    )
  }
  if (!isObject(taskConfig)) {
    return handleError(
      new Error(`task: missing task config object\n${USAGE_INFO}`)
    )
  }
  const script = path.isAbsolute(scriptPath)
    ? path.normalize(scriptPath)
    : path.join(process.cwd(), scriptPath)
  const key = path.basename(script, '.js')

  // register tasks
  registerTask(key, script, taskConfig)
  registerGlobalTasks()
}

/**
 * Load a task script and create the related gulp tasks (based on provided config).
 * This function mostly does validation of input data, and defers to registerTaskSet.
 * @param {string} key
 * @param {string} scriptPath
 * @param {object} userConfig
 */
function registerTask(key, scriptPath, userConfig) {
  let builder = null
  const info = {
    path: scriptPath,
    exists: fs.existsSync(scriptPath),
    sources: [],
    errors: [],
    missingDeps: {},
  }
  if (key in _scripts) {
    return handleError(
      new Error(`Tasks already configured for '${key}'\n${USAGE_REDECLARE}`)
    )
  }
  if (info.exists) {
    try {
      builder = require(scriptPath)
    }
    catch(err) {
      if (_conf.strict) throw err
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
  }
  // save script info
  _scripts[key] = info
  // register and remember tasks
  if (builder) {
    registerTaskSet(key, userConfig, builder).forEach(t => {
      _tasks.push(t)
    })
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
    _scripts[key].sources = conf.src
    // check immediately in strict mode, and bail if a source is missing
    if (_conf.strict) {
      const missing = conf.src.filter(s => glob.sync(s).length === 0)
      if (missing.length !== 0) {
        throw new Error(`Missing sources in task ${key}: ${
          (missing.length > 1 ? '\n  ' : '') + missing.map(s => `'${s}'`).join('\n  ')
        }`)
      }
    }

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
  const remember = name => {
    if (_tasks.indexOf(name) === -1) {
      _tasks.push(name)
    }
  }
  const validTaskName = name => {
    return typeof name === 'string' && name !== '' && /\s/.test(name) === false
  }
  const endGame = (empty, message) => () => {
    if (empty) notify({
      plugin: 'gulp-task-maker',
      warn: true, message: message
    })
    if (_conf.debug === false) showLoadingErrors()
  }

  // Prepare the build and watch tasks
  const builders = _tasks.filter(s => s.indexOf('build') === 0)
  const watchers = _tasks.filter(s => s.indexOf('watch') === 0)
  const buildEnd = endGame(builders.length === 0, 'No build tasks found')
  const watchEnd = endGame(watchers.length === 0, 'No watch tasks found')

  // Apply only if enabled
  if (validTaskName(_conf.watchTask)) {
    gulp.task(_conf.watchTask, watchers, watchEnd)
    remember(_conf.watchTask)
  }
  if (validTaskName(_conf.buildTask)) {
    gulp.task(_conf.buildTask, builders, buildEnd)
    remember(_conf.buildTask)
  }
  if (_conf.defaultTask === true) {
    gulp.task('default', builders, buildEnd)
    remember('default')
  }

  // Other possible cases for the default task
  if (typeof _conf.defaultTask !== 'boolean') {
    if (validTaskName(_conf.defaultTask)) {
      gulp.task('default', [_conf.defaultTask])
      remember('default')
    }
    else if (Array.isArray(_conf.defaultTask) && _conf.defaultTask.length > 0) {
      gulp.task('default', _conf.defaultTask)
      remember('default')
    }
    else if (typeof _conf.defaultTask === 'function') {
      gulp.task('default', function () {
        showLoadingErrors()
        return _conf.defaultTask()
      })
      remember('default')
    }
  }
}

/**
 * Take the user's task config (which can be a single object,
 * or an array of config objects), and return an array of complete
 * and normalized config objects.
 * @param {string} key
 * @param {Object|Array} userConfig
 * @returns {Array}
 */
function normalizeUserConfig(key, userConfig) {
  if (!isObject(userConfig)) {
    handleError(
      new Error(`Invalid config object for '${key}'.\nExpected an array or object.\nReceived value: ${JSON.stringify(userConfig, null, 2)}`),
      _scripts[key].errors
    )
    return []
  }
  return (Array.isArray(userConfig) ? userConfig : [userConfig])
    // Sanity check
    .filter(isObject)
    // Normalize the src and watch properties
    .map(normalizeSrc)
    // And only keep valid configs objects
    .filter(conf => validateConfig(key, conf))
}

/**
 * Make sure the 'src' and 'watch' properties of an object are arrays of strings
 * @param {object} conf
 * @returns {object}
 */
function normalizeSrc(conf) {
  const validate = input => {
    const valid = []
    // keep strings, ditch duplicates
    for (const s of [].concat(input)) {
      const t = typeof s === 'string' ? s.trim() : ''
      if (t !== '' && valid.indexOf(t) === -1) valid.push(t)
    }
    return valid
  }
  const src = validate(conf.src)
  const watch = conf.watch === true ? src : validate(conf.watch)
  // shallow clone to replace the src and watch props cleanly
  return Object.assign(Object.create(null), conf, {
    src: src,
    watch: watch
  })
}

/**
 * Check that a config object is valid, show an error and drop
 * that config otherwise.
 * @param {string} key
 * @param {object} conf
 * @returns {boolean}
 */
function validateConfig(key, conf) {
  let errors = []
  if (typeof conf.dest !== 'string') {
    errors.push('Property \'dest\' must be a string')
  }
  if (!Array.isArray(conf.src) || conf.src.length === 0) {
    errors.push('Property \'src\' property is empty')
  }
  if (errors.length === 0) {
    return true
  }
  // save error for displaying later
  handleError(
    new Error(`Invalid config object for '${key}'\n${ errors.join('\n') }\nIn config: ${
      JSON.stringify(conf, null, 2)
    }`),
    _scripts[key].errors
  )
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
 */
function showLoadingErrors() {
  if (_flags.errorsShown) {
    return
  }

  const failedTasks = []
  const taskStatus = {}
  const missingDependencies = []

  // Construct data for full report
  for (const key of Object.keys(_scripts)) {
    const info = _scripts[key]
    const messages = []
    const scriptMsg = info.exists
      ? '✔ Using ' + info.path
      : '✘ Script not found! ' + info.path
    // missing dependencies
    const mDeps = Object.keys(info.missingDeps)
    if (mDeps.length !== 0) {
      messages.push(`✘ Missing dependenc${mDeps.length > 1?'ies':'y'}: ${
        mDeps.map(s => `'${s}'`).join(', ')
      }`)
      // prepare missing info for the npm install prompt
      for (const name of mDeps) {
        missingDependencies.push(name + '@' + info.missingDeps[name])
      }
    }
    // check sources (already checked in strict mode)
    if (!_conf.strict) {
      const mSources = info.sources.filter(s => glob.sync(s).length === 0)
      if (mSources.length !== 0) {
        messages.push(`✘ Missing sources: ${
          (mSources.length > 1 ? '\n  ' : '') + mSources.map(s => `'${s}'`).join('\n  ')
        }`)
      }
    }
    for (const error of info.errors) {
      let msg = error.message || error.toString()
      messages.push(
        '✘ ' + (msg.startsWith('Error') ? '' : 'Error: ') +
        msg.replace(/\n/g, '\n  ')
      )
    }
    if (!info.exists || messages.length !== 0) {
      failedTasks.push(key)
    }
    taskStatus[key] = [scriptMsg].concat(messages)
  }

  if (failedTasks.length !== 0) {
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
    _flags.errorsShown = true
    const taskList = failedTasks.map(s => `'${s}'`).join(', ')
    handleError(
      new Error(`Error${failedTasks.length>1?'s':''} in ${taskList}\n${fullMsg}`)
    )
  }
}

/**
 * Return a copy of config and task loading status. Helpful for troubleshooting.
 * @return {object}
 */
function getDebugInfo() {
  const status = {
    config: Object.assign({}, _conf),
    flags: Object.assign({}, _flags),
    registered: _tasks.slice(),
    scripts: {}
  }
  // clone the script info
  for (const scriptId of Object.keys(_scripts)) {
    const info = _scripts[scriptId]
    const copy = {
      path: info.path,
      exists: info.exists,
      sources: info.sources.slice(), // copy strings
      knownMissingDependencies: {}, // we will copy strings next
      errors: info.errors.slice(), // copying references!
    }
    for (const name of Object.keys(info.missingDeps)) {
      copy.knownMissingDependencies[name] = info.missingDeps[name]
    }
    status.scripts[scriptId] = copy
  }
  return status
}
