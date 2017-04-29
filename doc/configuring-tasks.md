Configuring tasks with gulp-task-maker
======================================

*Table of contents:*

* [The load and task methods](#the-load-and-task-methods)
* [The task configuration object](#the-task-configuration-object)
* [Multiple builds for a task](#multiple-builds-for-a-task)
* [The build and watch tasks](#the-build-and-watch-tasks)
* [Errors and debugging](#errors-and-debugging)
* [Advanced config](#advanced-config)
* [Overriding global tasks](#overriding-global-tasks)
* [Enabling system notifications](#enabling-system-notifications)

***

## The load and task methods

Let’s say you have one or several task scripts that work with `gulp-task-maker`, living in some folder in your project. (If you don’t, see the [Writing tasks](writing-tasks.md) page, and/or check out the `example` directory in this repo for basic examples.)

There are two ways to call these task scripts and pass one or several config objects to them.

A. Use the `load` method to load several task scripts at once:

```js
const gtm = require('gulp-task-maker')

gtm.load(
  // relative path to directory where your task scripts live
  'my/tasks/directory',
  // config for all tasks
  {
    taskName: { src: 'x', dest: 'y' },
    other_task: { /* … */ }
  }
)
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
)
```

You can use both methods in the same `gulpfile.js`, which can be useful if your tasks live in different places:

```js
const gtm = require('gulp-task-maker')

gtm.load('node_modules/our-default-task-package', {
  foo: { /* … */ },
  bar: { /* … */ }
})
gtm.task('other-tasks/baz.js', {
  /* … */
})
```

## The task configuration object

The task configuration object can contain whatever you want, but three keys have special meaning:

- `src`, required: a string or array of glob patterns; `gulp-task-maker` will notify you if one of those paths or patterns match zero files.
- `dest`, required: a string defining where the compilation result will go. Could be a folder or file name.
-  `watch`, optional: if true, `gulp-task-maker` will watch the `src` patterns for file changes; if set as a string or array of strings, it will watch those.

For instance if you have a task that concatenates and minify JS code, you could have this config:

```js
const gtm = require('gulp-task-maker')

const vendorJS = [
  'node_modules/jquery/dist/jquery.js',
  'node_modules/other-lib/dist/other-lib.js'
]
const ourJS = [
  'src/core/*.js',
  'src/module1/*.js',
  'src/module4/*.js'
]

gtm.task('gulp-tasks/minjs.js', {
  src: vendorJS.concat(ourJS),
  watch: ourJS,
  dest: 'public/main.js',
  revisions: true,
  minify: true
})
```

Note that in your task scripts, you would still have to explictely use the config’s `src`, `dest`, `revisions` and `minify` values and do something useful with them. Only the `watch` property is handled 100% by `gulp-task-maker`. See the [Writing tasks](writing-tasks.md) page for more info.

## Multiple builds for a task

Each task can be called with multiple config objects:

```js
const gtm = require('gulp-task-maker')

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

## The build and watch tasks

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

## Errors and debugging

When configuring tasks, `gulp-task-maker` will suppress most errors as they happen, and try to display them all later in a compact display that may look like this:

```
[13:37:12] [gulp-task-maker] Errors in 'sometask', 'other' 
[sometask]
  ✔ Using ~/Code/my-project/gulp-tasks/sometask.js
  ✘ Missing sources: 'this/one/doesnt/exist.js'
[other]
  ✘ Script not found! ~/Code/my-project/gulp-tasks/other.js
```

There are a few options for getting more information.

1. If you’d rather stop the build on any config error, use the `strict` option:

```js
const gtm = require('gulp-task-maker')
gtm.conf({ strict: true })
gtm.load('gulp-tasks', { /* … */ })
```

2. You can also use the `info` method to get an object with `gulp-task-maker`’s config, known scripts and errors:

```js
const gtm = require('gulp-task-maker')
gtm.load('gulp-tasks', { /* … */ })
// console.dir instead of console.log to see deeper objects
console.dir(gtm.info(), {depth:3})
```

## Advanced config

Since `gulpfile.js` is a Node.js script, you can use the full power of JavaScript to build your configuration, if necessary.

We’ve seen how we can declare a system variable with `cross-env`. We could use that to make variations of our build, first passing different variables in `package.json`:

```json
{
  "scripts": {
    "build-prod": "cross-env BUILD=prod gulp build",
    "build-dev": "cross-env BUILD=dev gulp build",
    "watch": "cross-env BUILD=dev gulp watch"
  },
  "devDependencies": {
    "cross-env": "^4.0",
    "gulp": "^3.9",
    "gulp-task-maker": "^1.0"
  }
}
```

On the command line, you would run those shortcuts with e.g. `npm run build-dev`.

Now in your `gulpfile.js`, you can use the `BUILD` environment variable to change some build settings:

```js
const gtm = require('gulp-task-maker')
const isDev = process.env.TARGET === 'dev'

gtm.task('gulp-tasks/minjs.js', {
  src: ['node_modules/jquery/dist/jquery.js', 'src/*.js'],
  watch: 'src/*.js',
  // dev build = sourcemaps, not minified
  // prod build = no sourcemaps, minified
  dest: isDev
    ? 'dist/output.js'
    : 'dist/output.min.js',
  minify: !isDev,
  sourcemaps: isDev
})
```

This is just one possible approach. You could use two different config objects, instead of relying on npm scripts and environment variables:

```js
const gtm = require('gulp-task-maker')

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

## Overriding global tasks

You can override the global tasks (`build`, `watch` and `default`) with the `conf` method:

```js
const gtm = require('gulp-task-maker')

// override the default config
// ⚠ BEFORE any gtm.load or gtm.task
gtm.conf({
  // override the 'build' name;
  // or set to false to disable
  buildTask: 'my-build-name',
  // override the 'watch' name;
  // or set to false to disable
  watchTask: 'my-watch-name',
  // disable the 'default' task
  defaultTask: false
})

// or set the 'default' task to something else
gtm.conf({
  defaultTask: ['my-build-name', 'my-watch-name', 'some-other-task']
})

// you can use a function too
gtm.conf({
  defaultTask: function(){ /* do something, probably with gulp */ }
})
```

## Enabling system notifications

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

Now you can run the main `build` task with `npm run build`.

Note: the `cross-env` package is used to set a command variable that works on Windows as well as *nix systems. If you only use macOS and Linux, you could ditch it.
