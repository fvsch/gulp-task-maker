const glob = require('glob')
const { options, scripts } = require('./state')
const { customLog } = require('./helpers')
const { showError } = require('./tools')
const util = require('util')

/**
 * Usage info for several errors
 * @type {string}
 */
const USAGE_INFO = `
Expected usage:
const gtm = require('gulp-task-maker')

// set up a single task
gtm.add('./path/to/tasks/something.js', { … })

// or skip the script loader and provide your own function
gtm.add(myTaskFunction, { … })
`

/**
 * Show saved errors if things went wrong
 */
function onExit() {
  if (!onExit.done) {
    if (options.strict !== true) showLoadingErrors()
    if (options.debug === true) showDebugInfo()
  }
  onExit.done = true
}

/**
 * Get debug info such as the current options and GTM state
 * @return {object}
 */
function showDebugInfo() {
  customLog(`gulp-task-maker options:\n${util.inspect(options)}`)
  for (const data of scripts) {
    const info = {
      callback: data.callback,
      configs: data.normalizedConfigs,
      errors: data.errors
    }
    customLog(
      `gulp-task-maker script '${data.name}':\n${util.inspect(info, {
        depth: 6
      })}`
    )
  }
}

/**
 * Store an error for later, log it instantly or throw if in strict mode
 * @param {object} err - error object
 * @param {Array} [store] - where to store the error for later
 */
function handleError(err, store) {
  if (err && !err.plugin) {
    err.plugin = 'gulp-task-maker'
  }
  if (Array.isArray(store)) {
    store.push(err)
  } else {
    showError(err)
  }
}

/**
 * Show errors which occurred when first loading a task's script.
 */
function showLoadingErrors() {
  const failedTasks = []
  const taskStatus = {}

  // Construct data for full report
  for (const data of scripts) {
    const messages = []
    // check sources
    const mSources = data.sources.filter(s => glob.sync(s).length === 0)
    if (mSources.length !== 0) {
      messages.push(
        `✘ Missing sources: ${(mSources.length > 1 ? '\n  ' : '') +
          mSources.map(s => `'${s}'`).join('\n  ')}`
      )
    }
    // display remaining errors
    for (const error of data.errors) {
      let msg = error.message || error.toString()
      const prefix = msg.startsWith('Error') ? '' : 'Error: '
      messages.push(`✘ ${prefix}${msg.replace(/\n/g, '\n  ')}`)
    }
    if (messages.length > 0) {
      failedTasks.push(data.name)
    } else {
      messages.push(`✔ No issues detected`)
    }
    taskStatus[data.name] = messages
  }

  if (failedTasks.length !== 0) {
    const messages = []
    for (const key of Object.keys(taskStatus)) {
      messages.push(
        `${key}:\n  ${taskStatus[key].join('\n').replace(/\n/g, '\n  ')}`
      )
    }

    showError(
      new Error(
        `${failedTasks.length > 1 ? 'Errors' : 'Error'} in ${failedTasks
          .map(s => `'${s}'`)
          .join(', ')}\n${messages.join('\n')}`
      )
    )
  }
}

module.exports = {
  USAGE_INFO,
  handleError,
  onExit,
  showDebugInfo,
  showLoadingErrors
}
