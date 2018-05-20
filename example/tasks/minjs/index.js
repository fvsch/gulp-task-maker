const path = require('path')
const concat = require('gulp-concat')
const uglify = require('gulp-uglify')

/**
 * Make a simple JS build, optionally concatenated and minified
 * @param {object} config - task configuration
 * @param {object} tools - gtm utility functions
 * @return {object}
 */
function minjs(config, tools) {
  const ext = path.extname(config.dest)

  return tools.simpleStream(config, [
    ext === '.js' && concat(path.basename(config.dest)),
    config.minify && uglify(config.uglifyjs)
  ])
}

minjs.baseConfig = {
  minify: true,
  sourcemaps: '.',
  uglifyjs: {
    output: { inline_script: true },
    compress: { drop_debugger: false },
    preserveComments: 'license'
  }
}

module.exports = minjs
