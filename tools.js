/**
 * @file Common tools for tasks
 */

const gulp = require('gulp')
const plumber = require('gulp-plumber')
const size = require('gulp-size')
const sourcemaps = require('gulp-sourcemaps')
const notifier = require('node-notifier')
const path = require('path')

const { customLog, isObject, isStream } = require('./helpers')
const { options } = require('./state')

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
  const plugin = err.plugin || 'gulp-task-maker'

  // Show system notification
  if (!err.warn && options.notify) {
    const where = path.basename(process.cwd())
    notifier.notify({
      title: `${where}: ${plugin} error`,
      message: message.replace(/\s*\n+\s*/g, '\n')
    })
  }

  // Throw or log in console
  if (options.strict) throw err
  else customLog(`${plugin} error: ${message}`)
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

/**
 * gulp workflow (read files, transform, then write to disk),
 * with sourcemaps support and better error and output logging
 * @param {object} config
 * @param {Array} transforms
 * @return {*}
 */
function simpleStream(config, transforms) {
  if (!Array.isArray(transforms)) {
    transforms = []
  }

  // check that we have a valid config
  let err = null
  if (!isObject(config)) {
    err = `missing config object, received '${typeof config}'`
  } else {
    const { dest, src } = config
    if (typeof dest !== 'string' && typeof dest !== 'function') {
      err = `expected a string or function for 'dest' property in config`
    } else if (!Array.isArray(src) && typeof src !== 'string') {
      err = `expected a string or array for 'src' property in config`
    }
  }
  if (err != null) {
    throw new Error(`${err}\n${JSON.stringify(config, null, 2)}`)
  }

  // create plumbed stream
  let stream = gulp
    .src(config.src, { allowEmpty: !options.strict })
    .pipe(catchErrors())

  // init sourcemaps
  if (config.sourcemaps) {
    stream = stream.pipe(sourcemaps.init())
  }

  // insert transforms in the middle
  for (const transform of transforms.filter(isStream)) {
    stream = stream.pipe(transform)
  }

  // log file sizes
  stream = stream.pipe(
    showSizes(typeof config.dest === 'string' ? config.dest + '/' : undefined)
  )

  // generate sourcemaps
  if (config.sourcemaps) {
    stream = stream.pipe(
      sourcemaps.write(
        typeof config.sourcemaps === 'string' ? config.sourcemaps : '.'
      )
    )
  }

  // write files
  return stream.pipe(gulp.dest(config.dest))
}

module.exports = {
  catchErrors,
  showError,
  showSizes,
  simpleStream
}
