/**
 * @type {object} userConfig - gulp-task-maker options
 * @property {boolean} strict - whether to throw errors or log them after the fact
 * @property {boolean} notify - use node-notifier for system notifications?
 * @property {object} prefix - prefixes for the build and watch tasks
 * @property {object} groups - names and configuration for task groups
 */
const config = {
  notify: true,
  strict: false,
  prefix: {
    build: 'build-',
    watch: 'watch-'
  },
  groups: {
    build: name => name.startsWith('build-'),
    watch: name => name.startsWith('watch-')
  }
}

/**
 * Boolean flags to lock some features
 * @type {object}
 * @property {boolean} errorsShown - ensure we only show the main error report once
 * @property {boolean} optionsLocked - avoid registering the 'build' and 'watch' tasks under several names
 */
const flags = {
  errorsShown: false,
  optionsLocked: false
}

/**
 * List of known scripts with status info
 * @type {object}
 */
const scripts = {}

/**
 * List of already registered tasks
 * @type {Array}
 */
const tasks = []

/**
 * Usage info for several errors
 * @type {string}
 */
const USAGE_INFO = `Expected usage:
const gtm = require('gulp-task-maker')

// set up with the task directory path
gtm.load('path/to/tasks', {
  mytask: { … },
  othertask: { … }
})

// or set up a single task
gtm.task('path/to/tasks/something.js', { … })

// or skip the script loader and provide your own function
gtm.task('task-id', { … }, taskFunction)
`

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
])
`

// make everything public
module.exports = {
  config,
  flags,
  scripts,
  tasks,
  USAGE_INFO,
  USAGE_REDECLARE,
  configure,
  copyState,
  strToBool,
  isObject
}

/**
 * Allows users to override default configuration
 * @param {object} [input]
 * @property {string|boolean|number} [input.notify]
 * @property {string|boolean|number} [input.strict]
 * @property {object} [input.prefix]
 * @property {object} [input.groups]
 */
function configure(input) {
  if (!isObject(input)) {
    return
  }
  for (const opt of ['strict', 'notify']) {
    if (['boolean', 'string', 'number'].indexOf(typeof input[opt]) !== -1) {
      config[opt] = strToBool(input[opt])
    }
  }
  if (isObject(input.prefix)) {
    for (const name of ['build', 'watch']) {
      if (typeof input.prefix[name] === 'string') {
        config.prefix[name] = input.prefix[name].trim().replace(/\s+/g, '-')
      }
    }
  }
  if (isObject(input.groups)) {
    for (const name of Object.keys(input.groups)) {
      const value = input.groups[name]
      if (typeof value === 'function' || Array.isArray(value)) {
        config.groups[name] = value
      }
      // falsy values disable a group
      else if (!value) {
        config.groups[name] = null
      }
    }
  }
}

/**
 * Return a copy of config and task loading status.
 * Helpful for troubleshooting.
 * @return {object}
 */
function copyState() {
  const status = {
    config: Object.assign({}, config),
    flags: Object.assign({}, flags),
    tasks: tasks.slice().sort(),
    scripts: {}
  }
  for (const scriptId of Object.keys(scripts)) {
    const info = scripts[scriptId]
    const copy = {
      callback: info.callback, // string, or reference to a function
      sources: info.sources.slice(), // copy strings
      knownMissingDependencies: {}, // we will copy strings next
      errors: info.errors.slice(), // new array, contains references
    }
    if (typeof info.exists === 'boolean') {
      copy.exists = info.exists
    }
    for (const name of Object.keys(info.missingDeps)) {
      copy.knownMissingDependencies[name] = info.missingDeps[name]
    }
    status.scripts[scriptId] = copy
  }
  return status
}

/**
 * Check if a string looks like a positive "word"
 * Accepts as true: true, 'true', 1, '1', 'on', and 'yes' (case-insensitive)
 * @param {string} x
 * @returns {boolean}
 */
function strToBool(x) {
  return ['1','true','on','yes'].indexOf(String(x).trim().toLowerCase()) !== -1
}

/**
 * Basic workaround for typeof null === 'object'
 * @param obj
 * @returns {boolean}
 */
function isObject(obj) {
  return obj !== null && typeof obj === 'object'
}
