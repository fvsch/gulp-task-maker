'use strict'

const concat = require('gulp-concat')
const gulp = require('gulp')
const gulpif = require('gulp-if')
const gutil = require('gulp-util')
const path = require('path')
const plumber = require('gulp-plumber')
const rename = require('gulp-rename')
const size = require('gulp-size')
const sourcemaps = require('gulp-sourcemaps')
const notify = require('./notify.js')

/**
 * Common tools for tasks. Includes:
 * - concat (gulp-concat),
 * - if or gulpif (gulp-if),
 * - rename (gulp-rename),
 * - sourcemaps (gulp-sourcemaps),
 * - plumber (gulp-plumber)
 * - notify (a custom notification function, using node-notifier)
 * - logErrors (gulp-plumber with a custom notification function),
 * - size (gulp-size)
 * - logSize (pre-configured gulp-size)
 */
module.exports = {
  // Gulp plugins
  'concat': concat,
  'gulpif': gulpif,
  'plumber': plumber,
  'rename': rename,
  'size': size,
  'sourcemaps': sourcemaps,

  // Logging helpers and error management
  'notify': notify,
  'logErrors': logErrors,
  'logSize': logSize,

  // Gulp-based file builder with sourcemaps and concatenation support,
  // allowing users to just inject one or a few transforms in the middle.
  'commonBuilder': commonBuilder
}

/**
 * gulp-plumber with our custom error handler
 * @returns {*}
 */
function logErrors() {
  return plumber(notify)
}

/**
 * Helper function using gulp-size to log the size and path
 * of a file we're about to to write to the filesystem.
 * @param {string} title - Title to differentiate different output
 * @return {*}
 */
function logSize(title) {
  return size({
    showFiles: true,
    showTotal: false,
    title: typeof title === 'string' ? title : ''
  })
}

/**
 * Create a gulp workload (read, transform, then write to disk),
 * with sourcemaps support and better error and output logging.
 * @param {object} config
 * @param {Array} transforms
 * @return {*}
 */
function commonBuilder(config, transforms) {
  if (!Array.isArray(transforms)) { transforms = [] }
  const destRoot = path.extname(config.dest) !== ''
    ? path.dirname(config.dest)
    : config.dest

  // sourcemaps off by default: not all file formats can use them!
  const doMaps = Boolean(config.sourcemaps)
  const destMaps = doMaps && typeof config.sourcemaps === 'string'
    ? config.sourcemaps
    : '.'

  // create plumbed stream, init sourcemaps
  let stream = gulp.src(config.src).pipe( plumber(notify) )
  if (doMaps) {
    stream = stream.pipe(sourcemaps.init())
  }

  // insert source transforms in the middle
  for (let t of transforms) {
    if (gutil.isStream(t)) stream = stream.pipe(t)
  }

  // log file sizes, write files and sourcemaps
  stream = stream.pipe(logSize(`./${destRoot}/`))
  if (doMaps) {
    stream = stream.pipe(sourcemaps.write(destMaps))
  }
  return stream.pipe( gulp.dest(destRoot) )
}
