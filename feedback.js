const glob = require('glob')
const { showError } = require('./tools')

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
 * @param {object} scripts
 */
function showLoadingErrors(scripts) {
  if (showLoadingErrors.shown) {
    // was turned off in previous versions, maybe we can remove this flag?
    return
  }
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
    showLoadingErrors.shown = true
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

/**
 * Usage info for several errors
 * @type {string}
 */
const USAGE_INFO = `
Expected usage:
const gtm = require('gulp-task-maker')

// set up with the task directory path
gtm.add('path/to/tasks', {
  mytask: { … },
  othertask: { … }
})

// or set up a single task
gtm.add('path/to/tasks/something.js', { … })

// or skip the script loader and provide your own function
gtm.add(myTaskFunction, { … })
`

/**
 * Usage info for redeclared tasks
 * @type {string}
 */
const USAGE_REDECLARE = `
This error happens when you’re trying to configure
the same task several times with gulp-task-maker.
Make sure you are not redeclaring the same task script.

// Usage for declaring a script with several builds:
const gtm = require('gulp-task-maker')

// bad, will fail!
gtm.add('path/to/mytask.js', { src: 'foo/*.js', dest: 'dist/foo.js' })
gtm.add('path/to/mytask.js', { src: 'bar/*.js', dest: 'dist/bar.js' })

// do this instead:
gtm.add('path/to/mytask.js', [
  { src: 'foo/*.js', dest: 'dist/foo.js' },
  { src: 'bar/*.js', dest: 'dist/bar.js' }
])
`

module.exports = {
  handleError,
  showLoadingErrors,
  USAGE_INFO,
  USAGE_REDECLARE
}
