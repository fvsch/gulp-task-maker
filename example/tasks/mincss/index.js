const path = require('path')
const autoprefixer = require('gulp-autoprefixer')
const concat = require('gulp-concat')
const csso = require('gulp-csso')

/**
 * Make a CSS build, optionally concatenated and minified
 * @param {object} config - task configuration
 * @param {object} tools - gtm utility functions
 * @return {object}
 */
function mincss(config, tools) {
  const ext = path.extname(config.dest)

  return tools.simpleStream(config, [
    config.autoprefixer && autoprefixer(config.autoprefixer),
    ext === '.css' && concat(path.basename(config.dest)),
    config.minify && csso(config.csso)
  ])
}

mincss.baseConfig = {
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
