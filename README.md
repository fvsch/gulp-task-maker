gulp-task-maker
===============

Helps you write gulp tasks focused on building assets, so that you can:

1. Separate task configuration and implementation.
2. Get matching `build` and `watch` tasks for free.
3. Improve developer usability by logging what gets written to disk, use system notifications for errors, etc.

It also bundles basic gulp plugins such as `gulp-sourcemaps`, `gulp-if` and `gulp-concat`.


Example usage
-------------

```js
// MY_PROJECT/gulpfile.js
require('gulp-task-maker')('gulp-tasks', {
  mytask: {
    src: ['src/foo/foo.js', 'src/bar/*.js'],
    dest: 'public/main.js',
    watch: true
  }
})
```

And the corresponding task script would be:

```js
// MY_PROJECT/gulp-tasks/mytask.js
const path = require('path')
const gulp = require('gulp')
const somePlugin = require('gulp-something')

module.exports = function mytask(config, tools) {
  const file = path.basename(config.dest)
  const dir = path.dirname(config.dest)
  return gulp.src(config.src)    // take some files
    .pipe(tools.logErrors())   // tell gulp to show errors and continue
    .pipe(tools.concat(file))  // use a gulp plugin to transform content
    .pipe(somePlugin())        // some other source transform
    .pipe(tools.size(dir))     // log resulting file path/names and size
    .pipe(gulp.dest(dir))      // write resulting files to destination
}
```

Note that the same setup can be simplified by using the `commonBuilder` helper:

```js
// MY_PROJECT/gulp-tasks/mytask.js
const path = require('path')
const somePlugin = require('gulp-something')

module.exports = function mytask(config, tools) {
  return tools.commonBuilder(config, [
    tools.concat(path.basename(config.dest)),
    somePlugin()
  ])
}
```

Finally, it’s recommended to create a `mytask.json` file alongside the `mytask.js` script, with a list of dependencies:

```json
{
  "dependencies": {
    "gulp-something": "^1.0.0"
  }
}
```

Why do that? Well, if you try to use a task which has missing dependencies, gulp-task-builder will read this JSON file (and those of other configured tasks) and give you the `npm` command to install them.

For more examples, see:

- the `example` directory in this repo
- the https://github.com/gradientz/assets-builder repo


Multiple builds for a task
--------------------------

Each task can be called with multiple config objects, wrapped in an array:

```js
// MY_PROJECT/gulpfile.js
require('gulp-task-maker')('gulp-tasks', {
  mytask: [
    {
      src: ['node_modules/abc/abc.js',
            'node_modules/xyz/xyz.js'],
      dest: 'public/vendor.js'
    },
    {
      src: ['src/foo/foo.js', 'src/bar/*.js'],
      dest: 'public/main.js',
      watch: true
    }
  ]
})
```


The `config` and `tools` arguments
----------------------------------

Your task function will be called with two arguments. You can call them however you want (e.g. `conf` and `$` for short), but we’ll use `config` and `tools` as a convention.

### `config`

The config object for a given build. This gets normalized to an object with those properties:

- `src`: array of strings
- `dest`: string
- all other properties are kept as-is

Note that you won’t need to use the `watch` property in your task's function, because it's managed automatically by `gulp-task-maker`.

### `tools`

The `tools` object is a collection of very common gulp plugins:

- `tools.concat`: gulp-concat
- `tools.if` or `tools.gulpif`: gulp-if
- `tools.rename`: gulp-rename
- `tools.sourcemaps`: gulp-sourcemaps
- `tools.plumber`: gulp-plumber
- `tools.size`: gulp-size

In addition to that, there are a few tools using `gulp-task-maker`’s logging-and-notification function:

- `tools.notify`: notification function, which takes a string or an object with the following properties: `plugin`, `message` (shown in system notifications and the console), `details` (shown in the console only).
- `tools.logErrors`: a function that sets up gulp-plumber with our custom `notify` function.
- `tools.logSize`: logs the path and size of output files.
- `tools.commonBuilder`: a function that creates a gulp stream with sourcemaps support, and applies your transforms in the middle. It needs the config object to known about the input and output paths. Usage: `tools.commonBuilder(config, [transform1(), transform2()])`.
