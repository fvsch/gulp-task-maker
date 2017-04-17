'use strict'

const gutil = require('gulp-util')
const notifier = require('node-notifier')

/**
 * Log and notify errors
 * Error objects we get from different gulp plugins can have very different
 * data, so sometimes it can be hard to display the right information.
 * @param {object} err
 * @return {object}
 */
module.exports = function notify(err) {
  let header = 'gulp-task-maker error'
  let message = typeof err === 'string' ? err : ''
  let details = ''
  let color = err.warn ? gutil.colors.reset : gutil.colors.red

  if (typeof err === 'object') {
    if (typeof err.plugin === 'string') {
      header = err.plugin + ' error'
    }
    if (err.title) {
      message = err.title
      details = (err.message || err.formatted || '')
      if (err.details) {
        details = details + (details ? '\n' : '') + err.details
      }
    } else {
      message = (err.message || err.formatted || '')
      if (err.details) {
        if (!message) message = err.details
        else details = err.details
      }
    }
    const file = err.file || err.filename || err.fileName
    if (file) {
      const fileMsg = 'In ' + file.replace(process.cwd()+'/', '')
      message = message ? message + '\n' + fileMsg : fileMsg
    }
    if (typeof err.colors === 'string') {
      err.colors.split('.').forEach(name => {
        if (name in color) color = color[name]
      })
    }
  }

  // Show error in console
  gutil.log(color(message),
    details ? ('\n' + details).replace(/\n/g, '\n  ') : '')

  // And in system notifications if we can (for errors only)
  const envSetting = process.env.NODE_NOTIFIER || process.env.node_notifier || '0'
  const showAlert = ['1','true','on'].indexOf(envSetting) !== -1
  if (showAlert && !err.warn) {
    notifier.notify({
      title: header,
      message: message.replace(/\s*\n\s*/g, ' ')
    })
  }

  // Necessary so that errors from gulp plugins dont stop watch tasks
  if (typeof this === 'object' && typeof this.emit === 'function') {
    this.emit('end')
  }

  // Useful when throwing, as in throw notify({…})
  return err
}