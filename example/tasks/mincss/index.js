const autoprefixer = require('gulp-autoprefixer')
const concat = require('gulp-concat')
const csso = require('gulp-csso')

/**
 * Make a CSS build, optionally concatenated and minified
 * @param {function} done - call to signal async completion
 * @param {object} config - task configuration
 * @param {object} tools - gtm utility functions
 * @return {object}
 */
function mincss(done, config, tools) {
  return tools.simpleStream(config, [
    config.autoprefixer && autoprefixer(config.autoprefixer),
    config.concat && concat(config.concat),
    config.minify && csso(config.csso)
  ])
}

mincss.baseConfig = {
  concat: false,
  minify: true,
  sourcemaps: '.',
  autoprefixer: {
    flexbox: 'no-2009',
    grid: false
  },
  csso: {
    restructure: false
  }
}

module.exports = mincss
