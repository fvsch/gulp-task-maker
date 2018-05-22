const { onExit } = require('./feedback')
const { addTasks } = require('./register')
const { setOptions } = require('./state')

process.on('exit', onExit)

module.exports = {
  add: addTasks,
  set: setOptions
}
