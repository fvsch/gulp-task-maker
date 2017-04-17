'use strict'

const concat = require('gulp-concat')
const gulp = require('gulp')
const gulpif = require('gulp-if')
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
  'if': gulpif,
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
 * @param {string} dir - path to output files
 * @return {*}
 */
function logSize(dir) {
  return size({
    showFiles: true,
    showTotal: false,
    title: 'Writing → ' + dir + '/'
  })
}

/**
 * Create a gulp read-then-write stream, with sourcemaps (enabled by default),
 * better error logging, and output logging.
 * @param {object} userConfig
 * @param {Array} transforms
 * @return {*}
 */
function commonBuilder(userConfig, transforms) {
  if (!Array.isArray(transforms)) { transforms = [] }
  const conf = Object.assign({ sourcemaps: true }, userConfig)
  const destRoot = path.extname(conf.dest) !== '' ? path.dirname(conf.dest) : conf.dest
  const destMaps = typeof conf.sourcemaps === 'string' ? conf.sourcemaps : '.'

  // create plumbed stream, init sourcemaps
  let stream = gulp.src(conf.src)
    .pipe( plumber(notify) )
    .pipe( gulpif(conf.sourcemaps, sourcemaps.init()) )

  // insert source transforms in the middle
  for (let transform of transforms) {
    stream = stream.pipe(transform)
  }

  // log file sizes, write files and sourcemaps
  return stream
    .pipe( logSize(destRoot) )
    .pipe( gulpif(conf.sourcemaps, sourcemaps.write(destMaps)) )
    .pipe( gulp.dest(destRoot) )
}
