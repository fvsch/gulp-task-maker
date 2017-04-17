gulp-task-maker
===============

Helps you write gulp tasks focused on building assets, so that you can:

1. Separate task configuration and implementation.
2. Get matching `build` and `watch` tasks for free.
3. Improve developer usability by logging what gets written to disk, use system notifications for errors, etc.

Example usage
-------------

```js
// MY_PROJECT/gulpfile.js
require('gulp-task-maker')('gulp-tasks', {
  concat: {
    src: ['src/foo/foo.js', 'src/bar/*.js'],
    dest: 'public/build.js',
    watch: true,
    someOption: true,
    otherOption: false
  }
})
```

And the corresponding task script would be:

```js
// MY_PROJECT/gulp-tasks/concat.js
const path = require('path')
const gulp = require('gulp')

module.exports = function(conf, tools) {
  const file = path.basename(conf.dest)
  const dir = path.dirname(conf.dest)
  return gulp.src(conf.src)    // take some files
    .pipe(tools.errors())      // tell gulp to show errors and continue
    .pipe(tools.concat(file))  // use a gulp plugin to transform content
    .pipe(tools.size(dir))     // log resulting file path/names and size
    .pipe(gulp.dest(dir))      // write resulting files to destination
}
```

For more examples, see:

- the `example` directory in this repo
- the https://github.com/gradientz/assets-builder repo
