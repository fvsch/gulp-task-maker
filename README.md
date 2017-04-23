gulp-task-maker
===============

⚠ Requires Node.js 4 or later.

Helps you write gulp tasks focused on building assets, so that you can:

1. Get matching `build` and `watch` tasks for free.
2. Separate task configuration and implementation.
3. Configure multiple builds for each task (e.g. with different sources and configuration).
4. Improve developer usability by logging what gets written to disk, use system notifications for errors, etc.

`gulp-task-maker` also bundles useful gulp plugins such as `gulp-sourcemaps`, `gulp-if` and `gulp-concat`, and provides a `commonBuilder` helper function that takes care of the most common tasks, reducing boilerplate between tasks.

*Table of contents:*

1. [Example usage](#example-usage)
2. [Configuring tasks](#configuring-tasks)
3. [Writing tasks](#writing-tasks)


Example usage
-------------

At the root of your project, install as a dependency:

```bash
npm install gulp-task-maker --save-dev
```

Then in your `gulpfile.js`, you could have:

```js
const gtm = require('gulp-task-maker')

const jsBuild = {
  src: ['src/foo/foo.js', 'src/bar/*.js'],
  dest: 'public/main.js',
  watch: true
}

gtm.load('gulp-tasks', {
  mytask: jsBuild // or [jsBuild1, jsBuild2, …]
})
```

This will instruct `gulp-task-maker` to load `./gulp-tasks/mytask.js`, which could look like:

```js
const path = require('path')
const gulp = require('gulp')
const somePlugin = require('gulp-something')

module.exports = function mytaskBuilder(config, tools) {
  const file = path.basename(config.dest)
  const dir = path.dirname(config.dest)
  return gulp.src(config.src)   // take some files
    .pipe(tools.logErrors())    // tell gulp to show errors and continue
    .pipe(tools.concat(file))   // concatenate files to just one
    .pipe(somePlugin())         // use a gulp plugin to transform content
    .pipe(tools.size(dir))      // log resulting file path/names and size
    .pipe(gulp.dest(dir))       // write resulting files to destination
}
```

We could also simplify our task’s function further by using the `tools.commonBuilder` helper:

```js
const path = require('path')
const somePlugin = require('gulp-something')

module.exports = function mytaskBuilder(config, tools) {
  return tools.commonBuilder(config, [
    tools.concat(path.basename(config.dest)),
    somePlugin()
  ])
}
```

Compared to a 100% DIY gulp workflow, we gained a few things:

- we separated the task’s logic (`gulp-tasks/mytask.js`) from the build’s config (input files’ paths, output path, and any other configuration you want), making it more portable;
- we can provide more than one build config, as an array of objects;
- we will get a watch task automatically;
- we improved error handling and result reports.


Configuring tasks
-----------------

### Using the load and task methods

Let’s say you have one or several task scripts that work with `gulp-task-maker`, living in some folder in your project. (If you don’t, see the next section, “Writing tasks”, and check out the `example` directory in this repo for basic examples.)

There are two ways to call these task scripts and pass one or several config objects to them.

A. Use the `load` method to load several task scripts at once:

```js
const gtm = require('gulp-task-maker')

gtm.load(
  // relative path to directory where your task scripts live
  'my/tasks/directory',
  // config for all tasks
  {  
    taskName: { src: 'x', dest: 'y' }  
    other_task: { … }
  }
}
```

This will look for the following files:

- `my/tasks/directory/taskName.js`
- `my/tasks/directory/other_task.js`

B. Alternatively, or in addition to the `load` method, use the `task` method to load a single script:

```js
const gtm = require('gulp-task-maker')

gtm.task(
  // relative path to script
  'my/tasks/directory/coolstuff.js',
  // config for this task
  { src: 'x', dest: 'y' }
}
```

You can use both methods in the same `gulpfile.js`, which can be useful if your tasks live in different places:

```js
const gtm = require('gulp-task-maker')

gtm.load('node_modules/our-default-task-package', {
  foo: { … },
  bar: { … }
})
gtm.task('other-tasks/baz.js', {
  …
})
```

### The task configuration object

The task configuration object can contain whatever you want, but three keys have special meaning:

- `src`, required: a string or array of glob patterns; `gulp-task-maker` will notify you if one of those paths or patterns match zero files.
- `dest`, required: a string defining where the compilation result will go. Could be a folder or file name.
-  `watch`, optional: if true, `gulp-task-maker` will watch the `src` patterns for file changes; if set as a string or array of strings, it will watch those.

For instance if you have a task that concatenates and minify JS code, you could have this config:

```js
cont gtm = require('gulp-task-maker')

const jsLibs = [
  'node_modules/jquery/dist/jquery.js',
  'node_modules/other-lib/dist/other-lib.js'
]
const ourJS = [
  'src/core/*.js',
  'src/module1/*.js,
  'src/module4/*.js'
]

gtm.task('gulp-tasks/minjs.js', {
  src: jsLibs.concat(ourJS),
  watch: ourJS,
  dest: 'public/main.js',
  revisions: true,
  minify: true
})
```

Note that in your task scripts, you would still have to explictely use the config’s `src`, `dest`, `revisions` and `minify` values and do something useful with them. Only the `watch` property is handled 100% by `gulp-task-maker`. See the [Writing tasks](#writing-tasks) section for more info.

### Multiple builds for a task

Each task can be called with multiple config objects:

```js
cont gtm = require('gulp-task-maker')

gtm.load('gulp-tasks', {
  // create two JS builds
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

### See what tasks are created

`gulp-task-maker` will create one or two tasks for each valid script & config object pair:

- a build task (e.g. `build-js-0`);
- and a matching watch task (e.g. `watch-js-0`) if the `watch` option is set to true or to a string or array of files.

It can also be useful to use gulp’s task list, using the built-in `--tasks` option:

```sh
$ ./node_modules/.bin/gulp --tasks
[13:37:00] Tasks for ~/gulp-task-maker/example/gulpfile.js
[13:37:00] ├── build-mincss
[13:37:00] ├── watch-mincss
[13:37:00] ├── build-minjs
[13:37:00] ├── watch-minjs
[13:37:00] ├─┬ watch
[13:37:00] │ ├── watch-mincss
[13:37:00] │ └── watch-minjs
[13:37:00] └─┬ build
[13:37:00]   ├── build-mincss
[13:37:00]   └── build-minjs
```

Notice the `build`, and `watch` tasks; they are global shortcut tasks that run all the `build-*` or `watch-*` tasks. (`gulp-task-maker` will also configure a `default` task as an alias for `build`.)

### Enabling system notifications

`gulp-task-maker` uses system notifications, via the `node-notifier` package, to signal configuration errors. (It can also use system notifications for errors occuring when processing source files, if tasks use the `tools.logErrors` or `tools.commonBuilder`.)

To enable system notifications, use the `NODE_NOTIFIER` or `NOTIFY` environment variables. You can do it globally in your `~/.bashrc` or similar, but I recommend using npm scripts for this.

For example, your `package.json` could look like this:

```json
{
  "scripts": {
    "build": "cross-env NOTIFY=1 gulp build",
    "watch": "cross-env NOTIFY=1 gulp watch"
  },
  "devDependencies": {
    "cross-env": "^4.0",
    "gulp": "^3.9",
    "gulp-task-maker": "^1.0"
  }
}
```

(The `cross-env` package is used to set a command variable that works on Windows as well as *nix systems. If you only use macOS and Linux, you could ditch it.)

Now you can run the main `build` task with:

```sh
npm run build
```

### Advanced config

Since `gulpfile.js` is a Node.js script, you can use the full power of JavaScript to build your configuration, if necessary.

We’ve seen how we can declare a system variable with `cross-env`. We could use that to make variations of our build, first passing different variables in `package.json`:

```json
{
  "scripts": {
    "build-prod": "cross-env NOTIFY=1 BUILD=prod gulp build",
    "build-dev": "cross-env NOTIFY=1 BUILD=dev gulp build",
    "watch": "cross-env NOTIFY=1 BUILD=dev gulp watch"
  },
  "devDependencies": {
    "cross-env": "^4.0",
    "gulp": "^3.9",
    "gulp-task-maker": "^1.0"
  }
}
```

And in your `gulpfile.js`:

```js
const gtm = require('gulp-task-maker')
const isDev = process.env.TARGET === 'dev'

gtm.task('gulp-tasks/minjs.js', {
  src: ['node_modules/jquery/dist/jquery.js', 'src/*.js'],
  watch: 'src/*.js',
  // dev build = sourcemaps, not minified  
  // prod build = no sourcemaps, minified
  dest: isDev?'dist/output.js':'dist/output.min.js',
  minify: !isDev,
  sourcemaps: isDev
})
```

This is just one possible approach. You could use two different config objects, instead of relying on npm scripts and environment variables:

```js  
const jsBuild = {
  src: [
    'node_modules/jquery/dist/jquery.js',  
    'node_modules/foo/foo.js',  
    'node_modules/bar/bar.js',
    'src/*.js',  
    'other-source/js/*.js'
  ],
  watch: ['src/*.js', 'other-source/js/*.js'],
  dest: 'dist/output.js',
  minify: true,
  sourcemaps: true
}

gtm.task('gulp-tasks/minjs.js', [  
  // dev = watch, sourcemaps, not minified  
  Object.assign(jsBuild, {minify:false}),  
  // prod = no watch, no sourcemaps, minified
  Object.assign(jsBuild, {watch:false, sourcemaps:false})
])
```

### Overriding global tasks

You can override the global tasks (`build`, `watch` and `default`) with `gulpTaskMaker.config`:

```js
const gtm = require('gulp-task-maker')

// override the default config
// ⚠ BEFORE any gtm.load or gtm.task
gtm.config({
  // override the 'build' name, or set to false to disable altogether
  buildTask: 'my-build-name',
  // override the 'watch' name, or set to false to disable altogether
  watchTask: 'my-watch-name',
  // disable the 'default' task
  defaultTask: false,
  // or set it to something else
  defaultTask: ['my-build-name', 'my-watch-name', 'some-other-task'],
  // you can also use a function
  defaultTask: function() {
    // do something, probably with gulp
  }
})

// check gulp-task-maker's config
console.log(gtm.config())
```


Writing tasks
-------------

### Creating a task script

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

### Define dependencies

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

### The config argument

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

### A note about how gulp plugins work

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
let stream = gulp.src(…).pipe(…)
if (someCondition) {
  stream = stream.pipe(transform)
}
return stream.pipe( gulp.dest(…) )
```

### The tools argument

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

### The commonBuilder helper

`gulp-task-maker` provides an helper function that takes care of this boilerplate:

```js
gulp.src(…)
  .pipe(tools.logErrors())
  .pipe(tools.sourcemaps.init())
  …
  .pipe(tools.logSize())
  .pipe(tools.sourcemaps.write())
  .pipe(gulp.dest(…))
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
