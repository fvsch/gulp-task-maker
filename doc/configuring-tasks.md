Configuring tasks with gulp-task-maker
======================================

*Table of contents:*

* [The load and task methods](#the-load-and-task-methods)
* [The task configuration object](#the-task-configuration-object)
* [Multiple builds for a task](#multiple-builds-for-a-task)
* [General configuration](#general-configuration)
* [Errors and debugging](#errors-and-debugging)
* [Advanced config with npm scripts](#advanced-config-with-npm-scripts)

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

Finally, if you don’t want `gulp-task-maker` to load your task’s function from the filesystem, you can pass it as a third argument to the `task` method:

```js
const gtm = require('gulp-task-maker')

gtm.task('my-task-name', { /* config */ }, function(config, tools) {
  /* do something with config */
})
```

## The task configuration object

The task configuration object can contain whatever you want, but three keys have special meaning:

- `src`, required: a string or array of glob patterns; `gulp-task-maker` will notify you if one of those paths or patterns match zero files.
- `dest`, required: a string defining where the compilation result will go. Could be a folder or file name.
- `watch`, optional: if true, `gulp-task-maker` will watch the `src` patterns for file changes; if set as a string or array of strings, it will watch those.

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

## General configuration

`gulp-task-maker` comes with a few default behaviors, represented by config options:

- `notify` (defaults to `true`): whether to show system notifications.
- `strict` (defaults to `false`): whether to throw errors happening when setting up or running tasks, or simply log them.
- `buildTask` (defaults to `build`): name of the main build task that runs all the individual build tasks; use false to disable it.
- `watchTask` (defaults to `watch`): name of the main watch task that runs all the individual watch tasks; use false to disable it.
- `defaultTask` (defauts to: `true`): should we set a `'default'` gulp task? If true, the `'default'` task will be an alias for the main build task; if false, it won’t be created at all. You can also provide a string or an array of strings (representing gulp task names), or a function.

All these options can be overriden by calling the `conf` method:

```js
const gtm = require('gulp-task-maker')

gtm.conf({
  notify: false,
  strict: true,
  buildTask: 'my-build-name',
  watchTask: false,
  defaultTask: ['my-build-name', 'some-other-task']
})

gtm.load('gulp-tasks', { /* … */ })
```

Note that the `conf` method cannot be used after the `load` or `task` methods have been called. You’ll get an error in that situation.

For the `notify` and `strict` options, you can also use values from environment variables, and they will be converted to booleans intelligently:

```js
gtm.conf({
  // strings like '1', 'on', 'true' and 'yes' will be true, others will be false
  notify: process.env.GULP_NOTIFY || true,
  strict: process.env.GULP_STRICT_ERRORS || false
})
```

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

But if for some reason your task configuration doesn’t seem to work and `gulp-task-maker` is not showing you any helpful error, there are a few things you can do:

1. Run `gulp --tasks` to get a list of successfully registered tasks. The output may look like this:

```sh
$ ./node_modules/.bin/gulp --tasks
[13:37:12] Tasks for ~/gulp-task-maker/example/gulpfile.js
[13:37:12] ├── build-mincss
[13:37:12] ├── watch-mincss
[13:37:12] ├── build-minjs
[13:37:12] ├── watch-minjs
[13:37:12] ├─┬ watch
[13:37:12] │ ├── watch-mincss
[13:37:12] │ └── watch-minjs
[13:37:12] └─┬ build
[13:37:12]   ├── build-mincss
[13:37:12]   └── build-minjs
```

2. Use the `strict` option to throw errors and see a stack trace:

```js
const gtm = require('gulp-task-maker')
gtm.conf({ strict: true })
gtm.load('gulp-tasks', { /* … */ })
```

3. Use the `info` method to get an object with `gulp-task-maker`’s config, known scripts and errors:

```js
const gtm = require('gulp-task-maker')
gtm.load('gulp-tasks', { /* … */ })
// console.dir instead of console.log to see deeper objects
console.dir(gtm.info(), {depth:3})
```

## Advanced config with npm scripts

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

On the command line, you would run those shortcuts with, for example, `npm run build-dev`.

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
