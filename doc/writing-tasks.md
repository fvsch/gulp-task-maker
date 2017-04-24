Writing tasks with gulp-task-maker
==================================

*Table of contents:*

* [Creating a task script](#creating-a-task-script)
* [Defining dependencies](#defining-dependencies)
* [The config argument](#the-config-argument)
* [A note about how gulp plugins work](#a-note-about-how-gulp-plugins-work)
* [The tools argument](#the-tools-argument)
* [The commonBuilder helper](#the-commonbuilder-helper)

***

## Creating a task script

The minimal requirement for a task script is that it returns a function. This one is a valid `gulp-task-maker` task script:

```js
// gulp-tasks/mytask.js
module.exports = function() {}
```

It’s not very useful though. Let’s add some actual logic.

Your function could look like any standard gulp task:

```js
// gulp-tasks/mytask.js
const gulp = require('gulp')
const concat = require('gulp-concat')

module.exports = function() {
  return gulp.src('my/source/files/*.js')
    .pipe(concat('build.js'))
    .pipe(gulp.dest('public/js'))
}
```

Tip: always return the gulp stream — the part that looks like `.pipe(gulp.dest(…))` in the end — if you want gulp to be able to log the task’s duration correctly. Or you might see things like `"Finished 'build-mytask' after 50 μs"`, while your task actually took quite longer to complete.

## Defining dependencies

I recommend creating a `mytask.json` file alongside the `mytask.js` script, with a list of dependencies. For example:

```json
{
  "dependencies": {
    "gulp": "^3.9.1",
    "gulp-concat": "^2.6.0"
  }
}
```

Why do that? Well, if you try to use a task which has missing dependencies, gulp-task-builder will read the dependencies info from this JSON file, and print the `npm` command to install the missing ones.

This can be useful if you want to copy tasks from one project to another, or if you want to have a collection of a dozen ready-to-use task scripts in your project, but only install dependencies for the few you’re actually using!

Note that this feature will only print some information to the console; it won’t manage dependencies or resolve version conflicts for you! Still, it’s helpful to have it, if only as documentation for your task scripts when porting them from one project to another.

## The config argument

This is the config object used with the `gulpTaskMaker.load` and `gulpTaskMaker.task` methods, with a few normalized properties:

- `src` and `watch`, normalized as arrays of strings
- `dest`, normalized as a string
- all other properties are kept as-is

Note that you can ignore the `watch` property: it’s managed automatically by `gulp-task-maker`.

Let’s use this object to make our task function actually configurable.

```js
const gulp = require('gulp')
const path = require('path')
const concat = require('gulp-concat')

module.exports = function(config) {
  let file = 'build.js'
  let dir = config.dest
  // filename from 'config.dest' if there is one
  if (path.extname(config.dest) === '.js') {
    file = path.basename(config.dest)
    dir = path.dirname(config.dest)
  }
  return gulp.src(config.src)
    .pipe(concat(file))
    .pipe(gulp.dest(dir))
}
```

We could also make some actions optional. For instance, let’s add facultative UglifyJS support. For that, we’re going to use `gulp-if`, which is already provided by `gulp-task-maker` in the second argument to our function, along with `gulp-concat` and other useful tools.

```js
const gulp = require('gulp')
const path = require('path')
const uglify = require('gulp-uglify')

module.exports = function(config, tools) {
  let file = 'build.js'
  let dir = config.dest
  // filename from 'config.dest' if there is one
  if (path.extname(config.dest) === '.js') {
    file = path.basename(config.dest)
    dir = path.dirname(config.dest)
  }
  // check the 'config.minify' option
  const minifyOrMaybeNot = tools.gulpif(
    config.minify === true,
    uglify()
  )
  return gulp.src(config.src)
    .pipe(tools.concat(file))
    .pipe(minifyOrMaybeNot)
    .pipe(gulp.dest(dir))
}
```

Now if we add `minify: true` to our task config, we will activate source minification.

## A note about how gulp plugins work

If you’re unfamiliar with the way gulp and gulp plugins work: they’re using [Node.js streams](https://nodejs.org/api/stream.html), which are representations of data (mostly files, when it comes to gulp).

Gulp plugins are Transform streams, which means they take some source data and transform it in some way (e.g. taking CSS and adding browser prefixes), and return a transformed stream which can be piped to the next Transform stream, or to a Writeable stream like `gulp.dest` (which takes the transformed files and writes them to disk).

Anyway, that’s why with gulp we tend to have a logic that looks like this:

```js
streamThatReadsFiles
  .pipe( transformStream1 )
  .pipe( transformStream2 )
  .pipe( streamThatWritesToDisk )
```

One issue when piping streams is that it can be hard to have an optional stream. For example, this code would fail:

```js
streamThatReadsFiles
  .pipe( transformStream1 )
  .pipe( someCondition ? transformStream2 : null )
  .pipe( streamThatWritesToDisk )
```

If you pipe one stream into something that is not a stream (like `null`), your script will crash. That’s what `gulp-if` tries to fix. It’s a utility function that checks a condition and returns either the second argument, or a “neutral” stream that just passes the data along.

```js
streamThatReadsFiles
  .pipe( transformStream1 )
  .pipe( gulpif(someCondition, transformStream2) )
  .pipe( streamThatWritesToDisk )
```

See the [gulp-if documentation](https://www.npmjs.com/package/gulp-if) for more options.

Note: you don’t have to use `gulp-if`, of course; you can always store the initial stream in a variable and then conditionnaly update the stream:

```js
let stream = gulp.src(/* … */).pipe(/* … */)
if (someCondition) {
  stream = stream.pipe(transform)
}
return stream.pipe(gulp.dest(/* … */))
```

## The tools argument

The second argument received by your task function is a collection of very common gulp plugins:

- `tools.concat`: gulp-concat
- `tools.gulpif`: gulp-if
- `tools.rename`: gulp-rename
- `tools.sourcemaps`: gulp-sourcemaps
- `tools.plumber`: gulp-plumber
- `tools.size`: gulp-size

In addition to that, there are a few tools using `gulp-task-maker`’s logging-and-notification function:

- `tools.notify`: notification function, which takes a string or an object with the following properties: `plugin`, `message` (shown in system notifications and the console), `details` (shown in the console only).
- `tools.logErrors`: a function that sets up gulp-plumber with our custom `notify` function.
- `tools.logSize`: logs the path and size of output files.

We can use those tools and helpers to make our task a bit friendlier for ourselves and others. In particular, we can:

1. Improve error management and logging (see [this short article](https://gist.github.com/floatdrop/8269868) on why it can be useful with gulp).
2. Add a log of files we’re writing to disk.

```js
const gulp = require('gulp')
const path = require('path')
const uglify = require('gulp-uglify')

module.exports = function(config, tools) {
  let file = 'build.js'
  let dir = config.dest
  if (path.extname(config.dest) === '.js') {
    file = path.basename(config.dest)
    dir = path.dirname(config.dest)
  }
  const minifyTransform = tools.gulpif(
    config.minify === true,
    uglify()
  )

  return gulp.src(config.src)
     // notify & log all errors happening next
    .pipe(tools.logErrors())
    // start sourcemaps
    .pipe(tools.sourcemaps.init())
    // concatenate sources
    .pipe(tools.concat(file))
    // apply UglifyJS, if enabled
    .pipe(minifyTransform)
    // log path and size of resulting files
    .pipe(tools.logSize())
    // write sourcemaps
    .pipe(tools.sourcemaps.write('.'))
    // and finally write to disk
    .pipe(gulp.dest(dir))
}
```

If you find that you’re repeating most of this structure from one task function to the next, you might want to use the `tools.commonBuilder` helper.

## The commonBuilder helper

`gulp-task-maker` provides an helper function that takes care of this boilerplate:

```js
gulp.src(/* … */)
  .pipe(tools.logErrors())
  .pipe(tools.sourcemaps.init())
  /* … */
  .pipe(tools.logSize())
  .pipe(tools.sourcemaps.write())
  .pipe(gulp.dest(/* … */))
```

… and lets you apply your own transforms in the middle. The `tools.commonBuilder(config, transforms)` helper function:

- uses `config.src` as input, and `config.dest` to figure out the output directory;
- logs errors and written files;
- has off-by-default sourcemaps support (activate by setting `config.sourcemaps` to `true` or to a relative path);
- and will apply any transforms you want, passed as an array of transforms.

Usage in your task’s function might look like this:

```js
module.exports = function(config, tools) {
  // Sourcemaps make sense for this task?
  // let's make them enabled-by-default.
  config = Object.assign({
    sourcemaps: '.'
  }, config)

  return tools.commonBuilder(config, [
    transform1(),
    transform2()
  ])
}
```

This helper also makes conditional transforms easier: if the `transforms` array contains values other than Transform streams (which are returned by all gulp plugins), they will be discarded.

```js
module.exports = function(config, tools) {
  // merge defaults and user options
  config = Object.assign({
    sourcemaps: '.',
    doTransform1: true,
    doTransform2: false,
    doTransform3: false
  }, config)

  return tools.commonBuilder(config, [
    // gulpif will return the specified transform,
    // or a transform that does nothing
    tools.gulpif(config.doTransform1, transform1()),

    // or you can use a ternary expression;
    // the null value will be discarded
    config.doTransform2 ? transform2() : null,

    // or even use the && operator
    config.doTransform3 && transform3(),
  ])
}
```
