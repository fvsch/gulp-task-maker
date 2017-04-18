gulp-task-maker
===============

Helps you write gulp tasks focused on building assets, so that you can:

1. Separate task configuration and implementation.
2. Get matching `build` and `watch` tasks for free.
3. Configure multiple builds for each task (e.g. with different sources and configuration).
4. Improve developer usability by logging what gets written to disk, use system notifications for errors, etc.

`gulp-task-maker` also bundles basic gulp plugins such as `gulp-sourcemaps`, `gulp-if` and `gulp-concat`, and provides a `commonBuilder` helper function that takes care of the most common tasks, reducing boilerplate between tasks.

⚠ Requires Node.js 4 or later.


Example usage
-------------

At the root of your project, install as a dependency:

```bash
npm install gulp-task-maker --save-dev
```

Then in your `gulpfile.js`, you could have:

```js
require('gulp-task-maker')('gulp-tasks', {
  mytask: {
    src: ['src/foo/foo.js', 'src/bar/*.js'],
    dest: 'public/main.js',
    watch: true
  }
})
```

This will instruct `gulp-task-maker` to load `./gulp-tasks/mytask.js`, which could look like:

```js
// gulp-tasks/mytask.js
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

Compared to a more DIY gulp workflow, we gained a few things:

- the task’s logic and its config (input files, output path, and any other configuration you want) are separated;
- we can provide more than one build config (as an array of objects);
- we will get a watch task automatically;
- we improved error handling and result reports.

We could also simplify our task’s function further by using the `tools.commonBuilder` helper:

```js
// gulp-tasks/mytask.js
const path = require('path')
const somePlugin = require('gulp-something')

module.exports = function mytaskBuilder(config, tools) {
  return tools.commonBuilder(config, [
    tools.concat(path.basename(config.dest)),
    somePlugin()
  ])
}
```

See the “Writing tasks” section for details.


Configuring tasks
-----------------

*TODO: explain syntax for the gulpTaskMaker function.*

### Multiple builds for a task

Each task can be called with multiple config objects, wrapped in an array:

```js
// gulpfile.js
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


Writing tasks
-------------

*TODO: reorganize this section*

I recommend creating a `mytask.json` file alongside the `mytask.js` script, with a list of dependencies:

```json
{
  "dependencies": {
    "gulp-something": "^1.0.0"
  }
}
```

Why do that? Well, if you try to use a task which has missing dependencies, gulp-task-builder will read this JSON file (and those of other configured tasks) and print the `npm` command to install them. This can be useful if you want to copy tasks from one project to another.

Your task function will be called with two arguments. You can call them however you want (e.g. `conf` and `$` for short), but we’ll use `config` and `tools` as a convention.

### The `config` argument

The config object for a given build. This gets normalized to an object with those properties:

- `src`: array of strings
- `dest`: string
- all other properties are kept as-is

Note that you won’t need to use the `watch` property in your task's function, because it's managed automatically by `gulp-task-maker`.

### The `tools` argument

The `tools` object is a collection of very common gulp plugins:

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

### The `commonBuilder` helper

Finally, `tools.commonBuilder(config, transforms)` is a helper function making use of most of these tools for you. It creates a gulp stream with optional sourcemaps support, manages logging errors and output, and applies your transforms in the middle. Usage looks like:

```js
module.exports = function(config, tools) {
  return tools.commonBuilder(config, [transform1(), transform2()])
}
```

If the `transforms` array contains values other than Transform streams (which are returned by all gulp plugins), they will be discarded. This can be useful when implementing conditional transforms:

```js
module.exports = function(config, tools) {
  // Three different conditional styles:
  // 1. gulpif will return the specified transform, or an inert transform
  // 2. or you can use a ternary expression; the null value will be discarded
  // 3. or even use the && operator; any non-object value will be discarded
  return tools.commonBuilder(config, [
    /* 1 */ tools.gulpif(config.doTransform1, transform1()),
    /* 2 */ config.doTransform2 ? transform2() : null,
    /* 3 */ config.doTransform3 && transform3(),
  ])
}
```
