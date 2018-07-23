gulp-task-maker
===============

A small wrapper for gulp, which helps you separate task configuration (objects) and implementation (functions).

Some advantages:

- Creates `watch` tasks automatically.
- Helps you write tasks with sourcemaps, and better logging and system notifications!
- Reuse the same task with different configuration objects, to create multiple builds.

⚠ Requires Node.js 6.5 or later.

## Install

Install `gulp` and `gulp-task-maker` as `devDependencies`:

```bash
npm install --save-dev gulp@4 gulp-task-maker@2
```

## Configure

Then in your `gulpfile.js`, use gulp-task-maker’s `add` method:

```js
const gtm = require('gulp-task-maker')
const test = config => { console.log(config) }

gtm.add(test, {
  src: './src/*.js',
  watch: true,
  dest: './public',
})
```

With this configuration, gulp-task-maker will create four gulp tasks:

- `build` (runs all `build_*` tasks)
- `watch` (runs all `watch_*` tasks)
- `build_test`
- `watch_test`

We can run them on the command line, for example using `npx` (which comes with recent versions of Node and/or `npm`):

```sh
# run the "parent" build task
$ npx gulp build
# run a specific task
$ npx gulp build_test
```

Let’s go back to our `gulpfile.js`. We could also:

- tell `gulp-task-maker` to load the `minifyJS` function from a node script,
- provide an array of config objects, instead of just one,
- and add any arbitrary config values we want on config objects.

Here is an updated example:

```js
gtm.add('./tasks/minifyJS', [
  {
    src: [
      'node_modules/jquery/dist/jquery.js',
      'node_modules/some-other-lib/dist/some-other-lib.js'
    ],
    dest: 'public',
    bundle: 'vendor.js',
    sourcemaps: '.'
  },
  {
    src: 'src/*.js',
    watch: true,
    dest: 'public',
    bundle: 'bundle.js',
    sourcemaps: '.'
  }
])
```

### Writing tasks

With the previous `gulpfile.js`, gulp-task-maker will load the module at `./tasks/minifyJS.js` (or `./tasks/minifyJS/index.js`). This module should export a function (and that function must be named, because we’re using its name for the gulp tasks’ names).

Here is a function that concatenates JS files, minifies the result, and writes it (plus a source map) to a destination folder.

```js
const concat = require('gulp-concat')
const uglify = require('gulp-uglify')

module.exports = function minifyJS(config, tools) {
  const transforms = [
    concat(config.bundle), // concatenate files
    uglify() // minify JS
  ]
  return tools.simpleStream(config, transforms)
}
```

If you’re used to gulp, you can see that we’re not using `gulp.src` and `gulp.dest`. Instead, we’re using `tools.simpleStream` which does this work for us, supports source maps, and logs file sizes. If we want the same result with gulp only, we have to write:

```js
const gulp = require('gulp')
const concat = require('gulp-concat')
const plumber = require('gulp-plumber')
const sourcemaps = require('gulp-sourcemaps')
const size = require('gulp-size')
const uglify = require('gulp-uglify')

module.exports = function minjs(config, tools) {
  // take some source files
  return gulp.src(config.src)
    // use gulp-plumber to log errors (to console + notifications)
    .pipe(tools.catchErrors())
    // start source maps
    .pipe(sourcemaps.init())
    // concatenate files
    .pipe(concat(config.bundle))
    // minify JS
    .pipe(uglify())
    // log resulting file names and size
    .pipe(size())
    // generate sourcemaps
    .pipe(sourcemaps.write(config.sourcemaps))
    // write resulting files to a directory
    .pipe(gulp.dest(config.dest))
}
```

This is a bit longer, as you can see.

### Running tasks

Finally we can run the gulp command, and get a console output that looks like this:

```sh
$ npx gulp build
[13:37:21] Using gulpfile ~/Code/my-project/gulpfile.js
[13:37:21] Starting 'default'...
[13:37:21] Starting 'build_minifyJS'...
[13:37:22] ./public/ main.js 88.97 kB
[13:37:22] Finished 'build_minifyJS' after 1.12 s
[13:37:22] Finished 'build' after 1.13 s
```

You could also run a specific build task, which can be useful when you have many:

```sh
$ npx gulp build_minifyJS
...
```

Or start the main `watch` task:

```sh
$ npx gulp watch
[13:37:49] Using gulpfile ~/Code/my-project/gulpfile.js
[13:37:49] Starting 'watch'...
[13:37:49] Starting 'watch_minifyJS'...
```

## Full API doc, debugging and more

For a complete guide on using `gulp-task-maker`’s API, see [the API docs](https://github.com/fvsch/gulp-task-maker/blob/v2/API.md).
