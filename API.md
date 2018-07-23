gulp-task-maker API
===================

*Table of contents:*

* [Task callbacks](#task-callbacks)
* [Task config objects](#task-config-objects)
* [Errors and debugging](#errors-and-debugging)
* [General configuration](#general-configuration)

***

`gulp-task-maker` exposes two methods:

1. `gtm.add(callback, /* task config(s) */)`:
   Lets you define gulp tasks with a callback and one or more config objects.

2. `gtm.set({ /* general options */ })`
   Lets you configure `gulp-task-maker`’s behavior.

## Task callbacks

The first parameter for `gtm.add` should be a function, or the name or path of a module which exports a function.

```js
// gulpfile.js
const gtm = require('gulp-task-maker')

// passing a named function as a callback
const myTask = (config, tools) => { tools.done() }
gtm.add(myTask, { … })

// importing a module (which must export a function)
gtm.add(require('./my-task.js'), { … })

// or let the add method require the module
gtm.add('./my-task.js', { … })
```

The function’s name will be used in the resulting gulp task names, so using an anonymous function will throw an error:

```js
// avoid anonymous functions
gtm.add(function(config, tools) {
  console.log(config)
  tools.done()
}, { … })
```

### Base task config: the `baseConfig` object

A task callback may have a default configuration, which will be merged with each config object:

```js
// gulpfile.js
const gtm = require('gulp-task-maker')

const myTask = (config, tools) => {
  console.log(config)
  tools.done()
}
myTask.baseConfig = {
  minify: true,
  watch: true,
  dest: './public/'
}

gtm.add(myTask, [
  { src: './src/foo/*.js', concat: 'foo.js' },
  { src: './src/bar/*.js', concat: 'bar.js' },
])
```

### Task callback arguments

Task callbacks receive two arguments:

1. `config` (object), the config passed to `gtm.add`, normalized and merged with the callback’s `baseConfig`.
2. `tools` (object), a collection of helpers from gulp and `gulp-task-maker`:
    - `tools.done` (function): a function provided by gulp4 to signal that a task is finished; you don’t need to use it if you’re already returning a stream.
    - `tools.catchErrors` (function): returns a pre-configured instance of `gulp-plumber`.
    - `tools.showError` (function): logs an error object to the console and optionally using system notifications.
    - `tools.showSizes` (function): returns a pre-configured instance of `gulp-size`.
    - `tools.simpleStream` (function): takes the task’s config object and an array of transform streams, and returns a stream with sourcemaps support, logging of errors and output files, etc. See [“Writing Tasks” in README.md](./README.md#writing-tasks) for details.

## Task config objects

The second parameter for `gtm.add` should be an object or an array of objects. `gulp-task-maker` will create one gulp task for each config object.

```js
// gulpfile.js
const gtm = require('gulp-task-maker')
const myTask = require('./my-task.js')

// configuring a single build
gtm.add(myTask, {
  src: './src/*.js',
  watch: true,
  dest: './public/',
  concat: 'main.js',
})

// configuring several builds using the same callback
gtm.add(myTask, [
  {
    src: ['./node_modules/foo/foo.js', './node_modules/bar/bar.js'],
    dest: './public/',
    concat: 'vendor.js'
  },
  {
    src: './src/*.js',
    watch: true,
    dest: './public/',
    concat: 'main.js',
  },
])
```

### Special config properties: src, watch and dest

The task configuration object can contain whatever you want, and all properties are optional, but three properties have special meaning:

- `src` (string or array of strings): one or several glob patterns that identify your source files; `gulp-task-maker` will notify you if one of those paths or patterns match zero files.
- `watch` (boolean or array of strings): if true, `gulp-task-maker` will watch the `src` patterns for file changes; if set as a string or array of strings, it will watch those.
- `dest` (string or function): by convention, the folder path where the task’s result will be written (to be used with `gulp.dest`).

### Making variants of a task

If you need to build the same sources and get a slightly different output, you can “fork” a config object and create several tasks:

```js
const gtm = require('gulp-task-maker')

const jsBuild = {
  src: [
    './node_modules/jquery/dist/jquery.js',
    './node_modules/foo/foo.js',
    './node_modules/bar/bar.js',
    './src/*.js',
    './other-source/js/*.js'
  ],
  watch: ['./src/*.js', './other-source/js/*.js'],
  concat: 'output.js',
  dest: './dist',
  minify: true,
  sourcemaps: true
}

gtm.add('./gulp-tasks/minjs.js', [
  // dev = watch, sourcemaps, not minified
  Object.assign({}, jsBuild, {minify:false, concat:'output.dev.js'}),
  // prod = no watch, no sourcemaps, minified
  Object.assign({}, jsBuild, {watch:false, sourcemaps:false})
])
```

## Errors and debugging

When configuring tasks, `gulp-task-maker` will suppress most errors as they happen, and try to display them all later in a compact display that may look like this:

```
[13:37:12] [gulp-task-maker] Errors in 'sometask', 'other' 
sometask:
  ✘ Missing sources: 'this/one/doesnt/exist.js'
other:
  ✘ Script not found! ~/Code/my-project/gulp-tasks/other.js
```

But if for some reason your task configuration doesn’t seem to work and `gulp-task-maker` is not showing you any helpful error, there are a few things you can do:

1. Run `gulp --tasks` to get a list of successfully registered tasks. The output may look like this:

```sh
$ npx gulp --tasks
[15:23:42] Tasks for ~/gulp-task-maker/example/gulpfile.js
[15:23:42] ├── build_mincss_normalize
[15:23:42] ├── build_mincss_main
[15:23:42] ├── watch_mincss_main
[15:23:42] ├─┬ build
[15:23:42] │ └─┬ <parallel>
[15:23:42] │   ├── build_mincss_normalize
[15:23:42] │   ├── build_mincss_main
[15:23:42] │   └── build_minjs
[15:23:42] ├─┬ watch
[15:23:42] │ └─┬ <parallel>
[15:23:42] │   ├── watch_mincss_main
[15:23:42] │   └── watch_minjs
[15:23:42] ├── build_minjs
[15:23:42] └── watch_minjs
```

2. Use the `strict` option to throw errors and see a stack trace:

```sh
$ GTM_STRICT=1 npx gulp build
```

3. Use the `debug` option to log an object with `gulp-task-maker`’s options, known scripts and errors:

```sh
$ GTM_DEBUG=1 npx gulp build
```

## General configuration

`gulp-task-maker` comes with a few default behaviors, represented by options:

- `debug` (defaults to `false`): show debug information.
- `notify` (defaults to `true`): use system notifications for errors.
- `parallel` (defaults to `true`): run gulp tasks in parallel.
- `strict` (defaults to `false`): whether to throw errors happening when setting up or running tasks, or simply log them.
- `buildPrefix` (defaults to `'build_'`): prefix to use for build tasks.
- `watchPrefix` (defaults to `'watch_'`): prefix to use for watch tasks.
- `groups`: configuration for task groups; by default, two groups are configured, `'build'` for all build tasks and `'watch'` for all watch tasks.

All these options can be overriden by calling the `set` method:

```js
const gtm = require('gulp-task-maker')

gtm.set({
  debug: true,
  notify: false,
  strict: true,
  groups: {
    // add a custom task group
    'custom-build': ['foo-0', 'bar']
  }
})

gtm.add('./gulp-tasks/some-task', { /* … */ })
```

For the `notify` and `strict` options, you can also use values from environment variables, and they will be converted to booleans intelligently:

```js
gtm.set({
  // strings like '1', 'on', 'true' and 'yes' will be true,
  // others will be false
  debug: process.env.GTM_DEBUG || true,
  notify: process.env.GTM_NOTIFY || false
})
```
