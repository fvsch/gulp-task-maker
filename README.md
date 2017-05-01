gulp-task-maker
===============

Helps you write gulp tasks focused on building assets, so that you can:

1. Separate task configuration and implementation.
2. Configure multiple builds for each task (e.g. with different sources and configuration).
3. Get matching `build` and `watch` tasks automatically.
4. Improve developer usability by logging what gets written to disk, use system notifications for errors, etc.

`gulp-task-maker` also bundles useful gulp plugins such as `gulp-sourcemaps`, `gulp-if` and `gulp-concat`, and provides a `commonBuilder` helper function that takes care of logging and sourcemaps, reducing boilerplate between tasks.

⚠ Requires Node.js 4 or later.

*Documentation:*

1. [Short guide to gulp-task-maker](#short-guide-to-gulp-task-maker)
2. [In depth: Configuring tasks](https://github.com/fvsch/gulp-task-maker/blob/master/doc/configuring-tasks.md)
3. [In depth: Writing tasks](https://github.com/fvsch/gulp-task-maker/blob/master/doc/writing-tasks.md)

***

Short guide to gulp-task-maker
------------------------------

### Install

At the root of your project, install `gulp` and `gulp-task-maker` as `devDependencies`:

```bash
npm install -D gulp gulp-task-maker
```

### Configure

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

This will instruct `gulp-task-maker` to load `./gulp-tasks/mytask.js`, and pass it your config object(s). Let’s see how this script might look.

### Write tasks

Your config in the previous step  will instruct `gulp-task-maker` to load `./gulp-tasks/mytask.js`, which could look like:

```js
const path = require('path')
const gulp = require('gulp')
const somePlugin = require('gulp-something')

module.exports = function(config, tools) {
  const file = path.basename(config.dest)
  const dir = path.dirname(config.dest)
  return gulp.src(config.src)      // take some files
    .pipe(tools.logErrors())       // tell gulp to show errors and continue
    .pipe(tools.concat(file))      // concatenate files to just one
    .pipe(somePlugin())            // use a gulp plugin to transform content
    .pipe(tools.size(`./{dir}/`))  // log resulting file path/names and size
    .pipe(gulp.dest(dir))          // write resulting files to destination
}
```

We could also simplify our task’s function further by using the `tools.commonBuilder` helper:

```js
const path = require('path')
const somePlugin = require('gulp-something')

module.exports = function(config, tools) {
  return tools.commonBuilder(config, [
    tools.concat(path.basename(config.dest)),
    somePlugin()
  ])
}
```

Once you have a task script you like, you can easily copy it to another project that uses `gulp-task-maker`, and only change the config.

For a complete guide about writing tasks for `gulp-task-maker`, see [In depth: Writing tasks](https://github.com/fvsch/gulp-task-maker/blob/master/doc/writing-tasks.md).

### Running tasks

Finally we can run the gulp command, and get a console output that looks like this:

```sh
$ gulp
[13:37:21] Using gulpfile ~/Code/my-project/gulpfile.js
[13:37:21] Starting 'build-mytask'...
[13:37:22] ./public/ main.js 88.97 kB
[13:37:22] Finished 'build-mytask' after 1.12 s
[13:37:22] Starting 'default'...
[13:37:22] Finished 'default' after 650 μs
```

Note that I’m using the global `gulp` command. If you didn’t install gulp globally (with `npm install -g gulp`), you can use it from the `node_modules` directory instead (and I’m going to use this notation from now on):

```sh
$ ./node_modules/.bin/gulp
...
```

Gulp’s `default` task will be set to run all configured builds. You could also explicitely use the main `build` task:

```sh
$ ./node_modules/.bin/gulp build
...
```

You could also run a specific build task, which can be useful when you have many:

```sh
$ ./node_modules/.bin/gulp build-mytask
...
```

Or start the main `watch` task:

```sh
$ ./node_modules/.bin/gulp watch
[13:37:49] Using gulpfile ~/Code/my-project/gulpfile.js
[13:37:49] Starting 'build-mytask'...
[13:37:49] Finished 'build-mytask' after 2.55 s
[13:37:49] Starting 'watch'...
[13:37:49] Finished 'watch' after 4.54 ms
```

For more, look at:

- the [Configuring tasks](https://github.com/fvsch/gulp-task-maker/blob/master/doc/configuring-tasks.md) and [Writing tasks](https://github.com/fvsch/gulp-task-maker/blob/master/doc/writing-tasks.md) pages;
- the [example directory](https://github.com/fvsch/gulp-task-maker/tree/master/example) in this repo; it contains a few easily fixable errors, to demonstrate how error reporting works.
