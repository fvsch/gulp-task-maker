'use strict'
const fs = require('fs')
const glob = require('glob')
const gulp = require('gulp')
const path = require('path')
const util = require('util')
const notify = require('./notify.js')
const shared = require('./shared.js')
const tools = require('./tools.js')

// shorter references to common state
const _conf = shared.config
const _flags = shared.flags
const _scripts = shared.scripts
const _tasks = shared.tasks

process.on('exit', () => {
  if (!_conf.strict) showLoadingErrors()
})

module.exports = {
  conf: configure,
  info: shared.copyState,
  load: loadTasks,
  task: loadSingle,
  tools: tools
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
 * Allows users to override default configuration
 * @param {object} [input] - options, or undefined to return the current config
 * @return {object}
 */
function configure(input) {
  if (_flags.optionsLocked) {
    return handleError(
      new Error('gulp-task-maker configuration cannot be changed at this point\n' +
      'The `conf` method cannot be called after any use of `load` or `task`.'))
  }
  shared.configure(input)
}

/**
 * Store an error for later, log it instantly or throw if in strict mode
 * @param {object} err - error object
 * @param {Array} [store] - where to store the error for later
 */
function handleError(err, store) {
  const later = Array.isArray(store) && _conf.strict === false
  if (err && !err.plugin) {
    err.plugin = 'gulp-task-maker'
  }
  if (later) store.push(err)
  else notify(err)
}

/**
 * Resolve the provided tasks directory path and return the createTasks function
 * @param {string} taskDir - task directory path or fully-fledged config
 * @param {Object} tasksConfig - tasks config
 */
function loadTasks(taskDir, tasksConfig) {
  if (typeof taskDir !== 'string') {
    return handleError(
      new Error(`load: missing taskDir option\n${shared.USAGE_INFO}`)
    )
  }
  if (!isObject(tasksConfig)) {
    return handleError(
      new Error(`load: missing task config object\n${shared.USAGE_INFO}`)
    )
  }
  _flags.optionsLocked = true
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
 * @param {string} scriptId
 * @param {object} taskConfig
 * @param {function} [builder]
 */
function loadSingle(scriptId, taskConfig, builder) {
  if (typeof scriptId !== 'string' || !scriptId) {
    return handleError(
      new Error(`task: first argument must be a string\n${shared.USAGE_INFO}`)
    )
  }
  if (!isObject(taskConfig)) {
    return handleError(
      new Error(`task: missing task config object\n${shared.USAGE_INFO}`)
    )
  }
  _flags.optionsLocked = true
  let key, action
  if (typeof builder === 'function') {
    key = scriptId
    action = builder
  } else {
    action = path.isAbsolute(scriptId)
      ? path.normalize(scriptId)
      : path.join(process.cwd(), scriptId)
    key = path.basename(action, '.js')
  }

  // register tasks
  registerTask(key, action, taskConfig)
  registerGlobalTasks()
}

/**
 * Load a task script and create the related gulp tasks (based on provided config).
 * This function mostly does validation of input data, and defers to registerTaskSet.
 * @param {string} key
 * @param {string|function} callback
 * @param {object} userConfig
 */
function registerTask(key, callback, userConfig) {
  if (key in _scripts) {
    return handleError(
      new Error(`Tasks already configured for '${key}'\n${_conf.USAGE_REDECLARE}`)
    )
  }
  let cb = null
  const info = {
    callback: callback,
    sources: [],
    errors: [],
    missingDeps: {},
  }
  if (typeof callback === 'function') {
    cb = callback
  }
  else if (typeof callback === 'string') {
    info.exists = fs.existsSync(callback)
    if (!info.exists) {
      handleError(new Error('Script not found: ' + callback), info.errors)
    }
    else {
      try {
        cb = require(callback)
      }
      catch (err) {
        if (_conf.strict) throw err
        // check dependencies if a task failed, even if the error was different
        info.missingDeps = checkDependencies(callback)
        const module = err.code === 'MODULE_NOT_FOUND' && typeof err.message === 'string'
          ? (err.message.match(/module '(.*)'/) || [null, null])[1]
          : null
        // we stored info about known missing dependencies; store this error if different only
        if (typeof module !== 'string' || module in info.missingDeps === false) {
          info.errors.push(err)
        }
      }
    }
  }
  // save script info
  _scripts[key] = info
  // register and remember tasks
  if (typeof cb === 'function') {
    registerTaskSet(key, userConfig, cb).forEach(t => {
      _tasks.push(t)
    })
  }
}

/**
 * Register matching 'build' and 'watch' gulp tasks and return their name
 * @param {string} key - short name of task
 * @param {Array|Object} data - config object or array of config objects
 * @param {Function} cb - callback that takes a config object
 * @returns {Array} - names of registered tasks
 */
function registerTaskSet(key, data, cb) {
  const taskNames = []

  normalizeUserConfig(key, data).forEach(function(item, index, normalized) {
    const id = key + (normalized.length > 1 ? '-' + index : '')
    const buildId = 'build-' + id
    const watchId = 'watch-' + id

    // save normalized sources, to be checked later
    item.src.forEach(s => _scripts[key].sources.push(s))
    // check immediately in strict mode, and bail if a source is missing
    if (_conf.strict) {
      const missing = item.src.filter(s => glob.sync(s).length === 0)
      if (missing.length !== 0) {
        return handleError(new Error(`Missing sources in task ${key}: ${
          (missing.length > 1 ? '\n  ' : '') + missing.map(s => `'${s}'`).join('\n  ')
        }`))
      }
    }

    // Register build task
    gulp.task(buildId, () => cb(item, tools))
    taskNames.push(buildId)

    // Register matching watch task
    if (Array.isArray(item.watch) && item.watch.length > 0) {
      gulp.task(watchId, () => gulp.watch(item.watch, [buildId]))
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

  // Prepare the build and watch tasks
  const builders = _tasks.filter(s => s.indexOf('build-') === 0)
  const watchers = _tasks.filter(s => s.indexOf('watch-') === 0)
  const buildEnd = () => {
    if (builders.length === 0) handleError(new Error('No build tasks found'))
  }
  const watchEnd = () => {
    if (watchers.length === 0) handleError(new Error('No watch tasks found'))
    // 'exit' event not happening for a watch task, show config errors now
    if (!_conf.strict) showLoadingErrors()
  }

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
    //return
  }
  const failedTasks = []
  const taskStatus = {}
  const fullDepsList = {}

  // Construct data for full report
  for (const key of Object.keys(_scripts)) {
    const info = _scripts[key]
    const messages = []
    if (info.exists !== false) {
      messages.push('✔ Using ' + util.inspect(info.callback))
    }
    // missing dependencies
    const mDeps = Object.keys(info.missingDeps)
    if (mDeps.length !== 0) {
      messages.push(`✘ Missing dependenc${mDeps.length > 1?'ies':'y'}: ${
        mDeps.map(s => `'${s}'`).join(', ')
      }`)
      // merge lists of missing dependencies (for duplicates, first wins)
      for (const name of mDeps) {
        if (name in fullDepsList) continue
        fullDepsList[name] = info.missingDeps[name]
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
    // display remaining errors
    for (const error of info.errors) {
      let msg = error.message || error.toString()
      messages.push(
        '✘ ' + (msg.startsWith('Error') ? '' : 'Error: ') +
        msg.replace(/\n/g, '\n  ')
      )
    }
    if (info.exists === false || messages.length > 1) {
      failedTasks.push(key)
    }
    taskStatus[key] = messages
  }

  if (failedTasks.length !== 0) {
    const messages = []
    const deps = Object.keys(fullDepsList).map(k => `${k}@${fullDepsList[k]}`)
    for (const key of Object.keys(taskStatus)) {
      messages.push(`[${key}]\n  ${
        taskStatus[key].join('\n').replace(/\n/g, '\n  ')
      }`)
    }
    let final = messages.join('\n')
    if (deps.length !== 0) {
      final += '\n\nInstall missing task dependencies with:\n' +
        '  npm install -D "' + deps.join('" "') + '"\n'
    }
    _flags.errorsShown = true
    const taskList = failedTasks.map(s => `'${s}'`).join(', ')
    handleError(
      new Error(`Error${failedTasks.length>1?'s':''} in ${taskList}\n${final}`)
    )
  }
}
