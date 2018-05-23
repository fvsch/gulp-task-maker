const addTasks = require('./add')
const { onExit } = require('./feedback')
const { setOptions } = require('./state')

process.on('exit', onExit)

module.exports = {
  add: addTasks,
  set: setOptions
}
