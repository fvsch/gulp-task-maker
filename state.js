const { isObject, strToBool } = require('./helpers')

/**
 * @type {object} options - gulp-task-maker options
 * @property {boolean} strict - whether to throw errors or log them after the fact
 * @property {boolean} notify - use node-notifier for system notifications?
 * @property {object} prefix - prefixes for the build and watch tasks
 * @property {object} groups - names and configuration for task groups
 */
const options = {
  debug: strToBool(process.env.GTM_DEBUG, false),
  notify: strToBool(process.env.GTM_NOTIFY, true),
  parallel: strToBool(process.env.GTM_PARALLEL, true),
  strict: strToBool(process.env.GTM_STRICT, false),
  buildPrefix: 'build_',
  watchPrefix: 'watch_',
  groups: {
    build: name => name.startsWith(options.buildPrefix),
    watch: name => name.startsWith(options.watchPrefix)
  }
}

/**
 * List of known scripts with status info
 * @type {Array}
 */
const scripts = []

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
  for (const key of ['debug', 'notify', 'parallel', 'strict']) {
    const value = input[key]
    if (typeof value === 'boolean') options[key] = value
    else if (value != null) options[key] = strToBool(value)
  }
  for (const key of ['buildPrefix', 'watchPrefix']) {
    const value = input[key]
    if (typeof value === 'string') {
      const trimmed = value.replace(/\s+/g, '')
      if (trimmed !== '') options[key] = trimmed
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

module.exports = {
  options,
  scripts,
  setOptions
}
