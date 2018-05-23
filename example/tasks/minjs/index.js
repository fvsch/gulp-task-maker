const concat = require('gulp-concat')
const uglify = require('gulp-uglify')

/**
 * Make a simple JS build, optionally concatenated and minified
 * @param {function} done - call to signal async completion
 * @param {object} config - task configuration
 * @param {object} tools - gtm utility functions
 * @return {object}
 */
function minjs(done, config, tools) {
  return tools.simpleStream(config, [
    config.concat && concat(config.concat),
    config.minify && uglify(config.uglifyjs)
  ])
}

minjs.baseConfig = {
  concat: false,
  minify: true,
  sourcemaps: '.',
  uglifyjs: {
    output: { inline_script: true },
    compress: { drop_debugger: false },
    preserveComments: 'license'
  }
}

module.exports = minjs
