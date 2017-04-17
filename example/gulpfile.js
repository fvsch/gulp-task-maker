/**
 * Simple test with a task that concatenates and minifies CSS and JS
 *
 * For example, the mincss task lives in the 'tasks' directory,
 * and consists of two files:
 * - mincss.js, the main function receiving the config;
 * - mincss.json, which lists the task's dependencies and will be read if one
 *   seems to be missing.
 *
 * For more examples of tasks that work with gulp-task-maker,
 * see https://github.com/gradientz/assets-builder
 */

require('gulp-task-maker')('tasks', {
  mincss: {
    src: [
      'node_modules/normalize.css/normalize.css',
      'src/*.css'
    ],
    watch: 'src/*.css',
    dest: 'dist/output.css'
  },
  minjs: {
    src: [
      'node_modules/jquery/dist/jquery.js',
      'src/*.js'
    ],
    watch: 'src/*.js',
    dest: 'dist/output.js'
  }
})
