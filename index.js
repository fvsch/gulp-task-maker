const {
  handleError,
  showLoadingErrors,
  USAGE_INFO,
  USAGE_REDECLARE
} = require('./feedback')

const {
  cloneData,
  isObject,
  loadScript,
  strToBool,
  toObjectArray
} = require('./helpers')

const {
  getTaskNames,
  registerTasks,
  registerTaskGroups
} = require('./register')

const { options, scripts } = require('./state')

/**
 * Register gulp tasks for a given callback function and config object(s)
 * @param {function|string} callback
 * @param {array|object} configs
 */
function addTasks(callback, configs) {
  // Prepare task data
  const data = {
    name: null,
    callback: null,
    configs: toObjectArray(configs),
    normalizedConfigs: [],
    errors: [],
    sources: []
  }

  // Get the callback function; throw errors, because we can't log them
  // later until we have identified a task name
  if (typeof callback === 'function') {
    data.callback = callback
  } else if (typeof callback === 'string') {
    const scriptId = callback.trim()
    try {
      data.callback = loadScript(scriptId)
    } catch (err) {
      return handleError(err)
    }
  } else {
    return handleError(
      new Error(
        `Callback argument must be a string or a named function\n${USAGE_INFO}`
      )
    )
  }

  // Should not happen, but just in case
  if (typeof data.callback !== 'function') {
    throw new Error('Missing task callback')
  }

  // Figure out the real name (using displayName and name properites)
  data.name = data.callback.displayName || data.callback.name
  if (typeof data.name !== 'string') {
    return handleError(
      new Error(
        `Callback function cannot be anonymous\n(use a function declaration or the  displayName property)\n${USAGE_INFO}`
      )
    )
  }

  // Save script data (avoid registering the same gulp task ids twice)
  if (scripts.some(item => item.name === data.name) === false) {
    scripts.push(data)
  } else {
    return handleError(
      new Error(`Task '${data.name}' already configured\n${USAGE_REDECLARE}`)
    )
  }

  // Validate and merge configs
  if (data.configs.length === 0) {
    return handleError(
      new Error(
        `Task '${data.name}': missing or bad config object\n${USAGE_INFO}`
      ),
      data.errors
    )
  }

  // Defer to registerTasks for full validation and merging of configs,
  // and creating the actual gulp tasks
  registerTasks(data)
}

/**
 * Override default gulp-task-maker options
 * @param {object} [input] - options, or undefined to return the current config
 * @property {string|boolean|number} [input.notify]
 * @property {string|boolean|number} [input.strict]
 * @property {object} [input.prefix]
 * @property {object} [input.groups]
 * @return {object}
 */
function setOptions(input) {
  if (!isObject(input)) {
    throw new Error('gtm.conf method expects a config object')
  }
  for (const key of ['strict', 'notify', 'parallel']) {
    const value = input[key]
    if (typeof value === 'boolean') options[key] = value
    else if (value != null) options[key] = strToBool(value)
  }
  if (isObject(input.prefix)) {
    for (const name of ['build', 'watch']) {
      const value = input.prefix[name]
      if (typeof value === 'string') {
        options.prefix[name] = value.trim().replace(/\s+/g, '-')
      }
    }
  }
  if (isObject(input.groups)) {
    for (const name of Object.keys(input.groups)) {
      const value = input.groups[name]
      if (typeof value === 'function' || Array.isArray(value)) {
        options.groups[name] = value
      } else if (!value) {
        options.groups[name] = null // falsy values disable a group
      }
    }
  }
}

/**
 * Get debug info such as the current options and GTM state
 * @return {object}
 */
function getStatus() {
  return {
    gulpTasks: getTaskNames(),
    options: cloneData(options),
    scripts: cloneData(scripts)
  }
}

/**
 * Show saved errors if things went wrong
 */
process.on('exit', () => {
  if (!options.strict) showLoadingErrors(scripts)
})

module.exports = {
  add: addTasks,
  done: registerTaskGroups,
  options: setOptions,
  status: getStatus
}
