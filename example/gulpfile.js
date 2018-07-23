/**
 * Simple test with tasks that concatenate and minify CSS and JS
 *
 * For more examples of tasks using gulp-task-maker,
 * see https://github.com/kaliop/assets-builder
 */

const gtm = require('gulp-task-maker')

gtm.add('./tasks/mincss', [
  {
    name: 'normalize',
    src: './node_modules/normalize.css/normalize.css',
    dest: './dist',
    sourcemaps: false
  },
  {
    name: 'main',
    src: './src/*.css',
    concat: 'main.css',
    dest: './dist',
    watch: true
  }
])

gtm.add('./tasks/minjs', {
  src: ['./node_modules/jquery/dist/jquery.js', './src/*.js'],
  concat: 'main.js',
  dest: './dist',
  watch: 'src/*.js'
})
