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
  // File/task flow management
  'concat': concat,
  'if': gulpif,
  'gulpif': gulpif, // longer name for e.g. destructing
  'rename': rename,
  'sourcemaps': sourcemaps,

  // Logging helpers and error management
  'plumber': plumber,
  'notify': notify,
  'logErrors': function() {
    return plumber(notify)
  },
  'size': size,
  'logSize': logSize,

  // Gulp-based file builder with sourcemaps and concatenation support,
  // allowing users to just inject one or a few transforms in the middle.
  'commonBuilder': commonBuilder
}

/**
 * Helper function using gulp-size to log the size and path
 * of a file we're about to to write to the filesystem.
 * @param {string} dir - path to output files
 * @return gulp-size
 */
function logSize(dir) {
  return size({
    showFiles: true,
    showTotal: false,
    title: 'Writing → ' + dir + '/'
  })
}

/**
 * Create a gulp read-then-write stream, with sourcemaps (enabled by default)
 * and concatenation of sources (depending on if the `dest` config property
 * has an extension).
 * @param {object} userConfig
 * @param {Array} transforms
 */
function commonBuilder(userConfig, transforms) {
  if (Array.isArray(transforms)) {
    transforms = []
  }
  const conf = Object.assign({
    sourcemaps: true,
    concat: path.extname(userConfig.dest) !== ''
  }, userConfig)

  const destName = path.basename(conf.dest)
  const destRoot = conf.concat ? path.dirname(conf.dest) : conf.dest
  const destMaps = typeof conf.sourcemaps === 'string' ? conf.sourcemaps : '.'

  // create plumbed stream, init sourcemaps and concat
  let stream = gulp.src(conf.src)
    .pipe( plumber(notify) )
    .pipe( gulpif(conf.sourcemaps, sourcemaps.init()) )
    .pipe( gulpif(conf.concat, concat(destName)) )

  // insert source transforms in the middle (after concat)
  for (let transform of transforms) {
    stream = stream.pipe(transform)
  }

  // log file sizes, write files and sourcemaps
  return stream
    .pipe( logSize(destRoot) )
    .pipe( gulpif(conf.sourcemaps, sourcemaps.write(destMaps)) )
    .pipe( gulp.dest(destRoot) )
}
