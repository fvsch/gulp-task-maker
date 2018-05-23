const gulp = require('gulp')
const path = require('path')

const { handleError, USAGE_INFO } = require('./feedback')
const { isObject, toObjectArray, toUniqueStrings } = require('./helpers')
const { options, scripts } = require('./state')
const tools = require('./tools')

/**
 * Register gulp tasks for a given callback function and config object(s)
 * @param {function|string} callbackMixed
 * @param {array|object} configsMixed
 */
module.exports = function addTasks(callbackMixed, configsMixed) {
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
  if (configs.length === 0) {
    return handleError(
      new Error(`Task '${data.name}': missing config object\n${USAGE_INFO}`)
    )
  }
  const normalizedConfigs = configs
    .map(obj => normalizeConfig(obj, data))
    .filter(isObject)
  const sources = normalizedConfigs
    .map(conf => conf.src)
    .reduce((arr, item) => arr.concat(item), [])

  // Save data
  Object.assign(data, {
    configs: data.configs.concat(configs),
    normalizedConfigs: data.normalizedConfigs.concat(normalizedConfigs),
    sources: toUniqueStrings(data.sources.concat(sources))
  })

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
    gulp.task(buildId, done => callback(done, config, tools))

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
 * Normalize config object:
 * - Merge with baseConfig
 * - Check the 'dest', 'src' and 'watch' properties of config objects.
 *   (They can be missing, but if present they should be valid.)
 * @param {object} config
 * @param {object} data
 * @return {object|undefined}
 */
function normalizeConfig(config, data) {
  const newConfig = Object.assign({}, data.callback.baseConfig, config)
  const { dest, src, watch } = newConfig
  const errors = []

  if (dest != null && typeof dest !== 'string' && typeof dest !== 'function') {
    errors.push(`- 'dest' must be a string or a function`)
  }

  if (src != null) {
    newConfig.src = toUniqueStrings(newConfig.src)
    if (newConfig.src.length === 0) {
      errors.push(`- 'src' must be a string or an array of strings`)
    }
  }

  if (watch === true) {
    if (Array.isArray(newConfig.src) && newConfig.src.length) {
      newConfig.watch = [].concat(newConfig.src)
    }
  } else if (watch) {
    newConfig.watch = toUniqueStrings(newConfig.watch)
    if (newConfig.watch.length === 0) {
      errors.push(`- 'watch' must be boolean, a string or an array of strings`)
    }
  }

  if (errors.length > 0) {
    const msg = [
      `Invalid config for '${data.name}'`,
      errors.join('\n'),
      JSON.stringify(config, null, 2)
    ].join('\n')
    handleError(new Error(msg), options.strict ? null : data.errors)
    return
  }

  return newConfig
}
