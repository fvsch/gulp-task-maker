const gulp = require('gulp')
const path = require('path')
const autoprefixer = require('gulp-autoprefixer')
const csso = require('gulp-csso')

/**
 * Make a CSS build, optionally minified
 * @param {object} userConfig
 * @property {Array}   conf.src - glob patterns of files to concatenate
 * @property {string}  conf.dest - output folder or file name
 * @property {boolean} conf.minify - should we minify the output?
 * @property {boolean} conf.sourcemap - should we build sourcemaps?
 * @property {object}  conf.autoprefixer - autoprefixer config
 * @param {object} $ - utility functions provided by gulp-task-maker
 * @returns {*}
 */
module.exports = function cssconcatBuilder(userConfig, $) {

  // Merge defaults and user config
  const config = Object.assign({
    minify: true,
    sourcemaps: true,
    csso: {restructure: false},
    autoprefixer: {
      flexbox: 'no-2009',
      grid: false
    }
  }, userConfig)

  const doConcat = path.extname(config.dest) === '.css'
  const destName = path.basename(config.dest)
  const destRoot = doConcat ? path.dirname(config.dest) : config.dest
  const destMaps = typeof config.sourcemaps === 'string' ? config.sourcemaps : '.'

  return gulp.src(config.src)
    .pipe( $.logErrors() )
    .pipe( $.if(config.sourcemaps, $.sourcemaps.init()) )
    .pipe( $.if(doConcat, $.concat(destName)) )
    .pipe( $.if(config.autoprefixer, autoprefixer(config.autoprefixer)) )
    .pipe( $.if(config.minify, csso(config.csso)) )
    .pipe( $.logSize(destRoot) )
    .pipe( $.if(config.sourcemaps, $.sourcemaps.write(destMaps)) )
    .pipe( gulp.dest(destRoot) )
}
