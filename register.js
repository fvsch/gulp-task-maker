const gulp = require('gulp')

const { handleError, showLoadingErrors } = require('./feedback')
const { toUniqueStrings } = require('./helpers')
const { options, scripts } = require('./state')
const tools = require('./tools')

/**
 * Create a gulp task that executes child tasks in parallel
 * @param {string} name
 * @param {Array} childNames
 */
function defineGroupTask(name, childNames) {
  if (childNames.length === 0) {
    gulp.task(name, done => {
      handleError(new Error(`No tasks found in '${name}' group`))
      done()
    })
  } else {
    const mode = options.parallel ? gulp.parallel : gulp.series
    gulp.task(name, mode.apply(null, childNames))
  }
}

/**
 * Register matching 'build' and 'watch' gulp tasks
 * @param {string} taskId - short name of task
 * @param {function} callback - task callback
 * @param {object} config - config object
 * @param {object} tools - tools + dependencies
 */
function defineGulpTask(taskId, callback, config, tools) {
  const buildId = options.prefix.build + taskId
  const watchId = options.prefix.watch + taskId

  // Register build task
  gulp.task(buildId, () => callback(config, tools))

  // Register matching watch task
  if (Array.isArray(config.watch) && config.watch.length > 0) {
    gulp.task(watchId, () => {
      showLoadingErrors(scripts)
      return gulp.watch(config.watch, gulp.series(buildId))
    })
  }
}

/**
 * Get currently registered task names from Gulp
 */
function getTaskNames() {
  return gulp.tree({ deep: false }).nodes
}

/**
 * Make sure the 'src' and 'watch' properties of an object are arrays of strings
 * @param {object} conf
 * @return {object}
 */
function normalizeSrc(conf) {
  const src = toUniqueStrings(conf.src)
  const watch = conf.watch === true ? src : toUniqueStrings(conf.watch)
  // shallow clone to replace the src and watch props cleanly
  return Object.assign(Object.create(null), conf, {
    src: src,
    watch: watch
  })
}

/**
 * Take the user's task config (which can be a single object,
 * or an array of config objects), and return an array of complete
 * and normalized config objects.
 * @param {string} name
 * @param {object|undefined} baseConfig
 * @param {Array} userConfig
 * @return {Array}
 */
function normalizeUserConfig(name, baseConfig, userConfigs) {
  return (
    userConfigs
      .map(obj => Object.assign({}, baseConfig, obj))
      // Normalize the src and watch properties
      .map(normalizeSrc)
      // And only keep valid configs objects
      .filter(conf => validateConfig(name, conf))
  )
}

/**
 * @param {object} data
 */
function registerTasks(data) {
  const { name, callback, configs } = data

  // Check config validity
  const normalized = normalizeUserConfig(name, callback.defaultConfig, configs)
  data.normalizedConfigs = normalized

  // save sources list, to be checked later
  data.sources = Array.from(
    new Set(
      normalized.map(conf => conf.src).reduce((arr, item) => arr.concat(item))
    )
  )

  // Define gulp tasks (build and optionally watch)
  // For the task name:
  // - single config, no 'name' key: <callback>
  // - single config, 'name' key: <callback>_<name>
  // - multiple configs, no 'name' key: <callback>_<index>
  normalized.forEach((normalizedConfig, index) => {
    let taskId = name
    if (typeof normalizedConfig.name === 'string') {
      taskId += `_${normalizedConfig.name.trim()}`
    } else if (configs.length > 1) {
      taskId += `_${index + 1}`
    }
    defineGulpTask(taskId, callback, normalizedConfig, tools)
  })
}

/**
 * Register configured task groups; by default, 'build' and 'watch'
 * We might end up calling this several times (especially if using
 * the gulpTaskMaker.task method), but gulp seems to be okay with
 * overwriting a task reference with a new one.
 */
function registerTaskGroups() {
  const tasks = getTaskNames()
  for (const key of Object.keys(options.groups)) {
    const value = options.groups[key]
    const name = key.trim().replace(/[^a-z]+/gi, '')
    if (Array.isArray(value)) {
      defineGroupTask(name, value.filter(x => typeof x === 'string'))
    } else if (typeof value === 'function') {
      defineGroupTask(name, tasks.filter(value))
    }
  }
}

/**
 * Check that a config object is valid, show an error and drop
 * that config otherwise.
 * @param {string} name
 * @param {object} conf
 * @return {boolean}
 */
function validateConfig(name, conf) {
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
    options.strict ? null : scripts[name].errors
  )
  return false
}

module.exports = {
  getTaskNames,
  registerTasks,
  registerTaskGroups
}
