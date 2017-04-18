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
 * Create a gulp workload (read, transform, then write to disk),
 * with sourcemaps support and better error and output logging.
 * @param {object} config
 * @param {Array} transforms
 * @return {*}
 */
function commonBuilder(config, transforms) {
  if (!Array.isArray(transforms)) { transforms = [] }
  const destRoot = path.extname(config.dest) !== '' ? path.dirname(config.dest) : config.dest

  // sourcemaps off by default: not all file formats can use them!
  let doMaps = Boolean(config.sourcemaps), destMaps = '.'
  if (typeof config.sourcemaps === 'string') {
    doMaps = true; destMaps = config.sourcemaps
  }

  // create plumbed stream, init sourcemaps
  let stream = gulp.src(config.src)
    .pipe( plumber(notify) )
    .pipe( gulpif(doMaps, sourcemaps.init()) )

  // insert source transforms in the middle
  for (let t of transforms) {
    // check that it does look like a Transform stream
    if (typeof t === 'object' && t !== null && t.readable === true && t.writable === true) {
      stream = stream.pipe(t)
    }
  }

  // log file sizes, write files and sourcemaps
  return stream
    .pipe( logSize(destRoot) )
    .pipe( gulpif(doMaps, sourcemaps.write(destMaps)) )
    .pipe( gulp.dest(destRoot) )
}
