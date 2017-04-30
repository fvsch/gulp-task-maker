'use strict'
const gutil = require('gulp-util')
const notifier = require('node-notifier')
const _conf = require('./shared.js').config

/**
 * Log (and optionally notify) errors
 * Throws if gulp-task-maker is in strict mode
 * @param {object} err
 * @return {boolean} did we log/notify something?
 */
module.exports = function notify(err) {
  if (!err) {
    return false
  } else if (_conf.strict) {
    throw err
  }
  let message = typeof err === 'string' ? err : (err.message || err.formatted || '')
  let details = ''
  const file = err.file || err.filename || err.fileName

  if (message.indexOf('\n') !== -1) {
    const sep = '__SEP_ARA_TOR__'
    const parts = message.replace('\n', sep).split(sep, 2)
    message = parts[0]
    details = parts[1]
  }
  if (file) {
    details += (details.length ? '\n' : '')
      + 'In ' + file.replace(process.cwd()+'/', '')
  }
  // Show error in console
  const color = err.warn ? gutil.colors.reset : gutil.colors.red
  const prefix = err.plugin ? `[${err.plugin}] ` : ''
  gutil.log( color(prefix + message),
    details ? ('\n' + details).replace(/\n/g, '\n  ') : '')

  // And in system notifications if we can (for errors only)
  if (!err.warn && _conf.notify) {
    notifier.notify({
      title: err && err.plugin
        ? err.plugin + ' error'
        : 'gulp-task-maker error',
      message: message.replace(/\s*\n\s*/g, ' ')
    })
  }
  return true
}
