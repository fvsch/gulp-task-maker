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

const gulpTaskMaker = require('gulp-task-maker')

const mincssConfig = {
  src: [
    'node_modules/normalize.css/normalize.css',
    'src/*.css'
  ],
  watch: 'src/*.css',
  dest: 'dist/output.css'
}

const minjsConfig = {
  src: [
    'node_modules/jquery/dist/jquery.js',
    'src/*.js'
  ],
  watch: 'src/*.js',
  dest: 'dist/output.js'
}

// Showing two different ways to setup a task script
// - gulpTaskMaker.load takes a folder path, and the config for one or more scripts
// - gulpTaskMaker.task takes a script path, and the config for that script

gulpTaskMaker.load('tasks', { mincss: mincssConfig })
gulpTaskMaker.task('tasks/minjs.js', minjsConfig)
