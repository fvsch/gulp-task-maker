gulp-task-maker
===============

⚠ Requires Node.js 4 or later.

Helps you write gulp tasks focused on building assets, so that you can:

1. Separate task configuration and implementation.
2. Configure multiple builds for each task (e.g. with different sources and configuration).
3. Get matching `build` and `watch` tasks automatically.
4. Improve developer usability by logging what gets written to disk, use system notifications for errors, etc.

`gulp-task-maker` also bundles useful gulp plugins such as `gulp-sourcemaps`, `gulp-if` and `gulp-concat`, and provides a `commonBuilder` helper function that takes care of logging and sourcemaps, reducing boilerplate between tasks.

*Documentation:*

1. [Short guide to gulp-task-maker](#short-guide-to-gulp-task-maker)
2. [In depth: Configuring tasks](https://github.com/fvsch/gulp-task-maker/blob/master/doc/configuring-tasks.md)
3. [In depth: Writing tasks](https://github.com/fvsch/gulp-task-maker/blob/master/doc/writing-tasks.md)

***

Short guide to gulp-task-maker
------------------------------

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
