'use strict'
const gutil = require('gulp-util')
const notifier = require('node-notifier')
const path = require('path')
const _conf = require('./shared.js').config

/**
 * Log (and optionally notify) errors
 * Throws if gulp-task-maker is in strict mode
 * @param {object} err
 */
module.exports = function notify(err) {
  if (!err) return
  const message = typeof err === 'string' ? err
    : (err.message || err.formatted || '')

  // Show system notification
  if (!err.warn && _conf.notify) {
    const plugin = err.plugin || 'gulp-task-maker'
    const where = path.basename(process.cwd())
    notifier.notify({
      title: `${where}: ${plugin} error`,
      message: message.replace(/\s*\n+\s*/g, '\n')
    })
  }

  // Throw or log in console
  if (_conf.strict) throw err
  else {
    const prefix = err.plugin ? `[${err.plugin}] ` : ''
    const parts = message.replace('\n', '_S_E_P_').split('_S_E_P_', 2)
    const header = parts[0]
    const details = parts.length === 2 ? ('\n' + parts[1]).replace(/\n/g, '\n  ') : ''
    const color = err.warn ? gutil.colors.reset : gutil.colors.red
    gutil.log( color(prefix + header) + details)
  }
}
