'use strict'
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
 * see https://github.com/kaliop/assets-builder
 */

const gtm = require('gulp-task-maker')

gtm.conf({
  notify: true,  // use system notifications for errors? (default: true)
  strict: false  // throw errors immediately? (default: false, shows errors at the end)
})

gtm.load('tasks', {
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
