/**
 * Simple test with tasks that concatenate and minify CSS and JS
 *
 * For more examples of tasks using gulp-task-maker,
 * see https://github.com/kaliop/assets-builder
 */

const gtm = require('gulp-task-maker')

gtm.add(__dirname + '/tasks/mincss', [
  {
    name: 'normalize',
    src: 'node_modules/normalize.css/normalize.css',
    dest: 'dist/normalize.css',
    sourcemaps: false
  },
  {
    name: 'main',
    src: 'src/*.css',
    watch: true,
    dest: 'dist/main.css'
  }
])

gtm.add(__dirname + '/tasks/minjs', {
  src: ['node_modules/jquery/dist/jquery.js', 'src/*.js'],
  watch: 'src/*.js',
  dest: 'dist/main.js'
})

gtm.done()
