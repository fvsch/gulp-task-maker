'use strict'

const fs = require('fs')
const glob = require('glob')
const gulp = require('gulp')
const path = require('path')
const notify = require('./notify.js')
const tools = require('./tasktools.js')

/**
 * Resolve the provided tasks directory path and return the createTasks function
 * @param {string} dir - path to tasks directory
 * @param {Object} config - configuration for build tasks
 * @returns {Function}
 */
module.exports = function gulpTaskMaker(dir, config) {
  let taskDir = null
  let dirExists = false
  const hasConfig = config !== null && typeof config === 'object'
  if (typeof dir === 'string') {
    taskDir = path.isAbsolute(dir) ? path.normalize(dir) : path.join(process.cwd(), dir)
    dirExists = fs.existsSync(taskDir)
  }
  if (!taskDir) {
    showError({
      message: `No path or config provided`,
      details: `Expected usage:\n  require('gulp-task-maker')('path/to/tasks', tasksConfig)`
    })
  }
  else if (!dirExists) {
    showError({
      message: `Tasks directory doesn't exist`,
      details: `No such directory: ${taskDir}`
    })
  }
  if (!hasConfig) {
    showError({
      message: 'Missing config object',
      details: 'Make sure you call gulp-task-maker with a config object'
    })
  }
  if (dirExists && hasConfig) {
    createTasks(taskDir, config)
  }
  else {
    process.exitCode = 1
  }
}

/**
 * Set up gulp tasks, based on available task scripts and user-provided config
 * @param {string} taskDir - where the task scripts live
 * @param {Object} config - configuration for build tasks
 */
function createTasks(taskDir, config) {
  // Check that the task script exists
  const scripts = {}
  for (const key in config) {
    const scriptPath = taskDir + '/' + key.trim() + '.js'
    if (fs.existsSync(scriptPath)) {
      scripts[key] = scriptPath
    }
    else {
      showError({
        warn: true,
        message: `Warning: ignoring '${key}' config`,
        details: `File not found: ${scriptPath}`
      })
    }
  }

  // Register individual tasks
  const tasks = []
  try {
    for (const name in scripts) {
      const builder = require(scripts[name])
      createTaskSet(name, config[name], builder).forEach(t => tasks.push(t))
    }
  }
  catch(err) {
    let knownMissing = false
    if (err.code === 'MODULE_NOT_FOUND') {
      const missing = checkDependencies(scripts)
      const name = (err.message.match(/module '(.*)'/) || [null,null])[1]
      // did we alert about that missing dependency already?
      knownMissing = name && missing.indexOf(name) !== -1
    }
    if (!knownMissing) {
      throw err
    }
  }

  // Register tasks groups
  gulp.task('build', tasks.filter(s => s.includes('build')))
  gulp.task('watch', tasks.filter(s => s.includes('watch')))

  if (tasks.length === 0) {
    showError({ message: 'No valid tasks' })
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
 * Register matching 'build' and 'watch' gulp tasks and return their name
 * @param {string} key - short name of task
 * @param {Array|Object} configs - config object or array of config objects
 * @param {Function} builder - callback that takes a config object
 * @returns {Array} - names of registered tasks
 */
function createTaskSet(key, configs, builder) {
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
 * Load tasks' JSON files with dependencies, try loading each dependency
 * and log the missing deps with instructions on how to install.
 * Note: we are NOT resolving version conflicts of any kind.
 * @param {Object} scripts
 * @returns {Array} - names of missing modules
 */
function checkDependencies(scripts) {
  const missing = []
  // Try to load each dependency
  for (const name in scripts) {
    const badModules = []
    let deps = {}
    try {
      const json = scripts[name].replace('.js', '.json')
      deps = require(json).dependencies || {}
    } catch(e) {}
    for (const key in deps) {
      try { require(key) }
      catch(err) {
        if (err.code === 'MODULE_NOT_FOUND') {
          badModules.push({name: key, version: deps[key]})
        }
      }
    }
    if (badModules.length !== 0) {
      missing.push({task: name, modules: badModules})
    }
  }
  // Print information we found
  const modulesFlat = missing.reduce((arr, x) => arr.concat(x.modules), [])
  if (missing.length !== 0) {
    const taskList = missing.map(x => `'${x.task}'`).join(', ')
    const installList = modulesFlat
      .map(m => `"${m.name}@${m.version}"`)
      .join(`\\\n               `)
    showError({
      message: `Missing dependencies for ${taskList}`,
      details: `\nTo install missing dependencies, run:\n\nnpm install -D ${installList}\n`
    })
  }
  // Return names of missing modules
  return modulesFlat.map(m => m.name)
}

/**
 * Take the user's task config (which can be a single object,
 * an array of config objects), return an array of complete
 * and normalized config objects.
 * @param {string} configName
 * @param {Object|Array} userConfig
 * @returns {Array}
 */
function normalizeUserConfig(configName, userConfig) {
  if (typeof userConfig !== 'object') {
    showError({
      message: `Invalid '${configName}' config object`,
      details: `Config type: ${typeof userConfig}`
    })
    return []
  }
  return (Array.isArray(userConfig) ? userConfig : [userConfig])
    // Sanity check
    .filter(conf => typeof conf === 'object')
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
        .replace(/^{\n  /, '{ ')
        .replace(/\n}$/, ' }')
    })
    return false
  }
}
