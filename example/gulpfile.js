/**
 * Simple test with tasks that concatenate and minify CSS and JS
 *
 * For example, the mincss task lives in the 'tasks' directory,
 * and consists of two files:
 * - mincss.js, the main function receiving the config;
 * - mincss.json, which lists the task's dependencies and will be
 *   read if one seems to be missing.
 *
 * For more examples of tasks using gulp-task-maker,
 * see https://github.com/gradientz/assets-builder
 */

const gtm = require('gulp-task-maker')

const mincss = {
  src: [
    'node_modules/normalize.css/normalize.css',
    'src/*.css'
  ],
  watch: 'src/*.css',
  dest: 'dist/output.css'
}

const minjs = {
  src: [
    'node_modules/jquery/dist/jquery.js',
    'this/one/doesnt/exist.js',
    'src/*.js'
  ],
  watch: 'src/*.js',
  dest: 'dist/output.js'
}

gtm.load('tasks', { mincss, minjs })
