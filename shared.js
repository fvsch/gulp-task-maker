/**
 * @type {object} userConfig - gulp-task-maker options
 * @property {string|boolean} buildTask - name to use for the global 'build' task
 * @property {string|boolean} watchTask - name to use for the global 'watch' task
 * @property {*} defaultTask - value to use (string, array, function…) for the 'default' task
 * @property {boolean} strict - whether to throw errors or log them after the fact
 * @property {boolean} notify - use node-notifier for system notifications?
 */
const config = {
  buildTask: 'build',
  watchTask: 'watch',
  defaultTask: true,
  notify: true,
  strict: false
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
  strToBool
}

/**
 * Allows users to override default configuration
 * @param {object} [input]
 * @param {string|boolean} [input.notify]
 * @param {string|boolean} [input.strict]
 * @param {string|boolean} [input.buildTask]
 * @param {string|boolean} [input.watchTask]
 * @param {*} [input.defaultTask]
 */
function configure(input) {
  if (!input || typeof input !== 'object') return
  for (const opt of ['strict', 'notify']) {
    if (['boolean', 'string', 'number'].indexOf(typeof input[opt]) !== -1) {
      config[opt] = strToBool(input[opt])
    }
  }
  for (const opt of ['buildTask', 'watchTask']) {
    if (typeof input[opt] === 'string' || input[opt] === false) {
      config[opt] = input[opt]
    }
  }
  if (['boolean', 'string', 'object', 'function'].indexOf(typeof input.defaultTask) !== -1) {
    config.defaultTask = input.defaultTask
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
    //flags: Object.assign({}, flags),
    tasks: tasks.slice().sort(),
    scripts: {}
  }
  // clone the script info
  for (const scriptId of Object.keys(scripts)) {
    const info = scripts[scriptId]
    const copy = {
      callback: info.callback,
      sources: info.sources.slice(), // copy strings
      knownMissingDependencies: {}, // we will copy strings next
      errors: info.errors.slice(), // copying references!
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
