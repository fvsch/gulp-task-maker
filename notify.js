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
    message = (err.message || err.formatted || '')
    if (typeof message === 'string' && message.indexOf('\n') !== -1) {
      const sep = '__SEPARATOR__'
      const parts = message.replace('\n', sep).split(sep, 2)
      message = parts[0]
      details = parts[1]
    }
    const file = err.file || err.filename || err.fileName
    if (file) {
      details += (details.length ? '\n' : '')
        + 'In ' + file.replace(process.cwd()+'/', '')
    }
    if (typeof err.colors === 'string') {
      err.colors.split('.').forEach(name => {
        if (name in color) color = color[name]
      })
    }
  }

  // Show error in console
  gutil.log(
    color(err.plugin ? '['+err.plugin+'] ' + message : message),
    details ? ('\n' + details).replace(/\n/g, '\n  ') : ''
  )

  // And in system notifications if we can (for errors only)
  if (!err.warn) {
    const notifySetting = (process.env.NOTIFY
      || process.env.notify
      || process.env.NODE_NOTIFIER
      || process.env.node_notifier
      || '0').toLowerCase()
    if (['1','true','on'].indexOf(notifySetting) !== -1) notifier.notify({
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
