const { strToBool } = require('./helpers')

/**
 * @type {object} options - gulp-task-maker options
 * @property {boolean} strict - whether to throw errors or log them after the fact
 * @property {boolean} notify - use node-notifier for system notifications?
 * @property {object} prefix - prefixes for the build and watch tasks
 * @property {object} groups - names and configuration for task groups
 */
const options = {
  notify: strToBool(process.env.GTM_NOTIFY, true),
  parallel: strToBool(process.env.GTM_PARALLEL, true),
  strict: strToBool(process.env.GTM_STRICT, false),
  prefix: {
    build: '',
    watch: 'watch_'
  },
  groups: {
    build: name => !name.startsWith(options.prefix.watch),
    watch: name => name.startsWith(options.prefix.watch)
  }
}

/**
 * List of known scripts with status info
 * @type {Array}
 */
const scripts = []

module.exports = {
  options,
  scripts
}
