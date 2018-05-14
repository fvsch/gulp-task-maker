/**
 * @file Common tools for tasks. Includes:
 * - catchErrors (pre-configured gulp-plumber with system notifications)
 * - commonStream (implements a common gulp.src + transforms + gulp.dest workflow)
 * - notify (a custom notification function, using node-notifier)
 * - showSize (pre-configured gulp-size)
 */

const gulp = require('gulp')
const log = require('fancy-log')
const path = require('path')
const plumber = require('gulp-plumber')
const size = require('gulp-size')
const sourcemaps = require('gulp-sourcemaps')
const notifier = require('node-notifier')

const { isStream } = require('./helpers')
const { options } = require('./state')

/**
 * gulp workflow (read files, transform, then write to disk),
 * with sourcemaps support and better error and output logging
 * @param {object} config
 * @param {Array} transforms
 * @return {*}
 */
function simpleStream(config, transforms) {
  const { dest, src, sourcemaps: maps } = config
  if (!Array.isArray(transforms)) {
    transforms = []
  }

  // trim filename from dest, so that we write files to a folder
  const folder = path.extname(dest) !== '' ? path.dirname(dest) : dest
  const folderLogPath = './' + (folder.trim() ? `${folder}/` : '')

  // sourcemaps off by default: not all file formats can use them!
  let mapsUrl = null
  if (typeof maps === 'string') mapsUrl = maps
  else if (maps === true) mapsUrl = '.'

  // create plumbed stream, init sourcemaps
  let stream = gulp
    .src(src, { allowEmpty: !options.strict })
    .pipe(catchErrors())
  if (mapsUrl) stream = stream.pipe(sourcemaps.init())

  // insert source transforms in the middle
  for (const transform of transforms.filter(isStream)) {
    stream = stream.pipe(transform)
  }

  // log file sizes
  stream = stream.pipe(showSizes(folderLogPath))

  // write files
  if (mapsUrl) stream = stream.pipe(sourcemaps.write(mapsUrl))
  return stream.pipe(gulp.dest(folder))
}

/**
 * gulp-plumber with our custom error handler
 * @return {*}
 */
function catchErrors() {
  // don't use an arrow function, we need the `this` instance!
  return plumber(function(err) {
    if (!err.plugin) {
      err.plugin = 'gulp-task-maker'
    }
    showError(err)
    // keep watch tasks running
    if (this && typeof this.emit === 'function') {
      this.emit('end')
    }
  })
}

/**
 * Log errors (and optionally notify with a system notification)
 * Throws if gulp-task-maker is in strict mode
 * @param {object} err
 */
function showError(err) {
  if (!err) return
  const message =
    typeof err === 'string' ? err : err.message || err.formatted || ''

  // Show system notification
  if (!err.warn && options.notify) {
    const plugin = err.plugin || 'gulp-task-maker'
    const where = path.basename(process.cwd())
    notifier.notify({
      title: `${where}: ${plugin} error`,
      message: message.replace(/\s*\n+\s*/g, '\n')
    })
  }

  // Throw or log in console
  if (options.strict) throw err
  else {
    const prefix = err.plugin ? `[${err.plugin}] ` : ''
    const parts = message.replace('\n', '_S_E_P_').split('_S_E_P_', 2)
    const header = parts[0]
    const details =
      parts.length === 2 ? ('\n' + parts[1]).replace(/\n/g, '\n  ') : ''
    log(prefix + header + details)
  }
}

/**
 * Helper function using gulp-size to log the size and path
 * of a file we're about to to write to the filesystem.
 * @param {string} folder - shown as a 'title' prefix before the file name
 * @return {*}
 */
function showSizes(folder) {
  return size({
    showFiles: true,
    showTotal: false,
    title: folder || ''
  })
}

module.exports = {
  catchErrors,
  showError,
  showSizes,
  simpleStream
}
