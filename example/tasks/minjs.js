const uglify = require('gulp-uglify')

/**
 * Make a simple JS build, optionally minified
 * @param {object} userConfig
 * @property {Array}   conf.src - glob patterns of scripts to concatenate
 * @property {string}  conf.dest - output folder or file name
 * @property {boolean} conf.minify - should we minify the output?
 * @property {string|boolean} conf.sourcemaps - relative path for sourcemaps; false to disable
 * @property {object}  conf.uglify - custom gulp-uglify config
 * @param {object} tools - utility functions provided by gulp-task-maker
 * @returns {*}
 */
module.exports = function jsconcatBuilder(userConfig, tools) {

  // Merge defaults and user config
  const config = Object.assign({
    minify: true,
    uglifyjs: {
      output: {inline_script: true},
      compress: {drop_debugger: false},
      preserveComments: 'license'
    }
  }, userConfig)

  // Define the list of specific transforms to apply
  const transforms = []
  if (config.minify) {
    transforms.push(uglify(config.uglifyjs))
  }

  // Use gulp-task-maker's commonBuilder to create a gulp.src stream,
  // log info, apply sourcemaps, concatenate, and write the results
  return tools.commonBuilder(config, transforms)

}
