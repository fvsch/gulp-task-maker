const path = require('path')

/**
 * Basic workaround for typeof null === 'object'
 * @param {any} value
 * @return {boolean}
 */
function isObject(value) {
  return value !== null && typeof value === 'object'
}

/**
 * Check if it’s a stream, aka in the simplest expression it's an object
 * with a pipe method.
 * @param {any} value
 * @return {boolean}
 */
function isStream(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.pipe === 'function'
  )
}

/**
 * Load a task module
 * @param {string} id
 * @return {function}
 * @throws {Error}
 */
function loadScript(id) {
  let callback = null
  let scriptId = id

  // treat like a local path if it looks like one
  if (
    id.startsWith('./') ||
    id.startsWith('../') ||
    id.endsWith('.js') ||
    (id.includes('/') && !id.startsWith('@'))
  ) {
    if (path.isAbsolute(id) === false) {
      scriptId = path.join(process.cwd(), id)
    }
  }

  try {
    callback = require(scriptId)
  } catch (err) {
    throw new Error(`Could not load module '${scriptId}':\n${err}`)
  }
  if (typeof callback !== 'function') {
    throw new Error(
      `Expected module '${scriptId}' to export a function, was ${typeof callback}`
    )
  }
  return callback
}

/**
 * Check if a string looks like a positive "word"
 * Accepts as true: true, 'true', 1, '1', 'on', and 'yes' (case-insensitive)
 * @param {string} input
 * @param {boolean} defaultValue
 * @return {boolean}
 */
function strToBool(input, defaultValue = false) {
  const value = String(input)
    .trim()
    .toLowerCase()
  if (['1', 'true', 'on', 'yes'].includes(value)) return true
  if (['0', 'false', 'off', 'no'].includes(value)) return false
  return defaultValue
}

/**
 * Return an array of objects,
 * from input which can be an object or an array
 * @param {Array|object} input
 * @return {object[]}
 */
function toObjectArray(input) {
  return (Array.isArray(input) ? input : [input]).filter(isObject)
}

/**
 * Return an array of unique trimmed strings,
 * from input which can be a string or an array of strings
 * @param {Array|string} input
 * @return {string[]}
 */
function toUniqueStrings(input) {
  const list = (Array.isArray(input) ? input : [input])
    .map(el => (typeof el === 'string' ? el.trim() : null))
    .filter(Boolean)
  return list.length > 1 ? Array.from(new Set(list)) : list
}

module.exports = {
  isObject,
  isStream,
  loadScript,
  strToBool,
  toObjectArray,
  toUniqueStrings
}
