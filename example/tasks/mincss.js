const autoprefixer = require('gulp-autoprefixer')
const csso = require('gulp-csso')
const path = require('path')

/**
 * Make a CSS build, optionally minified
 * @param {object} config - user configuration
 * @param {object} tools - utility functions provided by gulp-task-maker
 * @returns {*}
 */
module.exports = function mincssBuilder(config, tools) {
  // Merge defaults and user config
  config = Object.assign({
    minify: true,
    sourcemaps: '.',
    csso: {
      restructure: false
    },
    autoprefixer: {
      flexbox: 'no-2009',
      grid: false
    }
  }, config)

  // All transforms are conditional
  const ext = path.extname(config.dest)
  const base = path.basename(config.dest)
  const transforms = [
    ext === '.css' && tools.concat(base),
    config.autoprefixer && autoprefixer(config.autoprefixer),
    config.minify && csso(config.csso)
  ]

  // Use gulp-task-maker's commonBuilder to create a gulp.src stream,
  // log info, apply sourcemaps, apply transforms, and write the results
  return tools.commonBuilder(config, transforms)
}
