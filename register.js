const gulp = require('gulp')
const path = require('path')

const { handleError, showLoadingErrors, USAGE_INFO } = require('./feedback')
const { toObjectArray, toUniqueStrings } = require('./helpers')
const { options, scripts } = require('./state')
const tools = require('./tools')

/**
 * Register gulp tasks for a given callback function and config object(s)
 * @param {function|string} callbackMixed
 * @param {array|object} configsMixed
 */
function addTasks(callbackMixed, configsMixed) {
  let callback = null
  try {
    callback = getTaskCallback(callbackMixed)
  } catch (err) {
    return handleError(err)
  }

  // Retrieve or create task data
  const cbName = callback.displayName || callback.name
  let data = scripts.find(script => script.name === cbName)
  if (!data) {
    data = {
      name: cbName,
      callback: callback,
      configs: [],
      normalizedConfigs: [],
      errors: [],
      sources: []
    }
    scripts.push(data)
  }

  // Validate and merge configs
  const configs = toObjectArray(configsMixed)
  const normalizedConfigs = normalizeConfigs(configs, data)
  const sources = normalizedConfigs
    .map(conf => conf.src)
    .reduce((arr, item) => arr.concat(item))

  // Save data
  if (configs.length === 0) {
    return handleError(
      new Error(`Task '${data.name}': missing config object\n${USAGE_INFO}`)
    )
  } else {
    data.configs = data.configs.concat(configs)
    data.normalizedConfigs = data.normalizedConfigs.concat(normalizedConfigs)
    data.sources = toUniqueStrings(data.sources.concat(sources))
  }

  // define gulp tasks and overwrite group tasks (e.g. 'build' and 'watch')
  defineTasksForConfig(data)
  defineTaskGroups()
}

/**
 * Register configured task groups; by default, 'build' and 'watch'
 * We might end up calling this several times (especially if using
 * the gulpTaskMaker.task method), but gulp seems to be okay with
 * overwriting a task reference with a new one.
 */
function defineTaskGroups() {
  const gulpTasks = gulp.tree({ deep: false }).nodes
  const gulpMode = options.parallel ? gulp.parallel : gulp.series
  const groups = Object.keys(options.groups).map(key => [
    key.trim().replace(/[^a-z]+/gi, ''),
    options.groups[key]
  ])

  groups.forEach(group => {
    const [name, value] = group
    let children = []

    if (Array.isArray(value)) {
      children = value
    } else if (typeof value === 'function') {
      children = gulpTasks
        .filter(value)
        // Group tasks should not call themselves/other groups
        .filter(child => !groups.includes(child))
    } else {
      return
    }

    if (children.length === 0) {
      gulp.task(name, done => {
        handleError(new Error(`No tasks found in '${name}' group`))
        done()
      })
    } else {
      gulp.task(name, gulpMode.apply(null, children))
    }
  })
}

/**
 * Register matching 'build' and 'watch' gulp tasks
 * @param {object} taskData
 */
function defineTasksForConfig(taskData) {
  // Define gulp tasks (build and optionally watch)
  // For the task name:
  // - single config, no 'name' key: <callback>
  // - single config, 'name' key: <callback>_<name>
  // - multiple configs, no 'name' key: <callback>_<index>
  const { callback, name, normalizedConfigs } = taskData
  normalizedConfigs.forEach((config, index) => {
    let taskId = name
    if (typeof config.name === 'string') {
      taskId += `_${config.name.trim()}`
    } else if (normalizedConfigs.length > 1) {
      taskId += `_${index + 1}`
    }
    const buildId = options.prefix.build + taskId
    const watchId = options.prefix.watch + taskId

    // Register build task
    gulp.task(buildId, () => callback(config, tools))

    // Register matching watch task
    if (Array.isArray(config.watch) && config.watch.length > 0) {
      gulp.task(watchId, () => {
        return gulp.watch(config.watch, gulp.series(buildId))
      })
    }
  })
}

/**
 * Check that a declared task uses a valid callback function
 * @param {string|Function} callback
 * @return {Function}
 * @throws {Error}
 */
function getTaskCallback(callback) {
  let result = null
  // Get the callback function; throw errors, because we can't log them
  // later until we have identified a task name
  if (typeof callback === 'function') {
    result = callback
  } else if (typeof callback === 'string') {
    let id = callback.trim()
    // treat like a local path if it looks like one
    if (
      id.startsWith('./') ||
      id.startsWith('../') ||
      id.endsWith('.js') ||
      (id.includes('/') && !id.startsWith('@'))
    ) {
      if (path.isAbsolute(id) === false) {
        id = path.join(process.cwd(), id)
      }
    }
    try {
      result = require(id)
    } catch (err) {
      throw new Error(`Could not load module '${id}':\n${err}`)
    }
    if (typeof result !== 'function') {
      throw new Error(
        `Expected module '${id}' to export a function, was ${typeof result}`
      )
    }
  } else {
    throw new Error(
      `Callback argument must be a string or a named function\n${USAGE_INFO}`
    )
  }
  const { displayName, name } = result || {}
  if (typeof displayName !== 'string' && typeof name !== 'string') {
    throw new Error(
      `Callback function cannot be anonymous\n(Use a function declaration or the displayName property.)\n${USAGE_INFO}`
    )
  }
  return result
}

/**
 * Merge task config with a task's baseConfig, and filter out invalid configs
 * @param {Array} configs
 * @param {Object} taskData
 * @return {Array}
 */
function normalizeConfigs(configs, taskData) {
  return (
    configs
      // Merge with default config
      .map(obj => Object.assign({}, taskData.callback.baseConfig, obj))
      // Normalize the src and watch properties
      .map(normalizeSrc)
      // And only keep valid configs objects
      .filter(conf => validateConfig(taskData.name, conf, taskData.errors))
  )
}

/**
 * Make sure the 'src' and 'watch' properties of an object are arrays of strings
 * @param {object} conf
 * @return {object}
 */
function normalizeSrc(conf) {
  const src = toUniqueStrings(conf.src)
  const watch = conf.watch === true ? src : toUniqueStrings(conf.watch)
  return Object.assign({}, conf, {
    src: src,
    watch: watch
  })
}

/**
 * Check that a config object is valid, show an error and drop
 * that config otherwise.
 * @param {string} name
 * @param {object} conf
 * @param {array} errorStore
 * @return {boolean}
 */
function validateConfig(name, conf, errorStore) {
  let errors = []
  if (typeof conf.dest !== 'string') {
    errors.push(`Property 'dest' must be a string`)
  }
  if (!Array.isArray(conf.src) || conf.src.length === 0) {
    errors.push(`Property 'src' property is empty`)
  }
  if (errors.length === 0) {
    return true
  }
  // save error for displaying later
  handleError(
    new Error(
      `Invalid config object for '${name}'\n${errors.join(
        '\n'
      )}\nIn config: ${JSON.stringify(conf, null, 2)}`
    ),
    options.strict ? null : errorStore
  )
  return false
}

module.exports = {
  addTasks
}
