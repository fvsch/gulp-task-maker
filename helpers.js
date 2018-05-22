const fancyLog = require('fancy-log')

/**
 * Custom long log format using fancy-log
 * @param {string} message
 */
function customLog(message) {
  const trimmed = message.trim()
  const limit = trimmed.indexOf('\n')
  if (limit === -1) {
    fancyLog(trimmed)
  } else {
    const title = trimmed.slice(0, limit).trim()
    const details = trimmed.slice(limit).trim()
    fancyLog(`${title}${('\n' + details).replace(/\n/g, '\n  ')}`)
  }
}

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
  customLog,
  isObject,
  isStream,
  strToBool,
  toObjectArray,
  toUniqueStrings
}
