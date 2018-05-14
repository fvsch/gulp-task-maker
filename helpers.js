/**
 * Get a deep copy of scalar data and objects that contain scalar data
 * @param {*} data
 * @param {object} depth - configure depth (e.g. to avoid infinite recursion)
 * @param {number} depth.max
 * @param {number} depth.current
 * @return {*}
 */
function cloneData(data, depth = 0) {
  const maxDepth = 10
  const type = typeof data
  if (
    data == null ||
    type === 'boolean' ||
    type === 'number' ||
    type === 'string'
  ) {
    return data
  }
  if (Array.isArray(data)) {
    const result = []
    if (depth < maxDepth) {
      for (const item of data) {
        result.push(cloneData(item, depth + 1))
      }
    }
    return result
  }
  if (type === 'object' || type === 'function') {
    const result = {}
    const subType =
      typeof data.constructor === 'function' ? data.constructor.name : ''
    // mark functions as such (when used for debugging)
    if (subType && subType !== 'Object') {
      let info = `[${subType}] `
      switch (subType) {
        case 'Function':
          info += data.name
          break
        case 'RegExp':
        case 'Error':
          info += String(data)
          break
      }
      result.__ = info.trim()
    }
    // prevent deep cloning the global object
    if (typeof global === 'object' && data === global) {
      return result
    }
    // clone enumerable properties
    if (depth < maxDepth) {
      for (const key of Object.keys(data)) {
        result[key] = cloneData(data[key], depth + 1)
      }
    }
    return result
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
 * Load a task module
 * @param {string} scriptId
 * @return {function}
 * @throws {Error}
 */
function loadScript(scriptId) {
  let callback = null
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
  cloneData,
  isObject,
  isStream,
  loadScript,
  strToBool,
  toObjectArray,
  toUniqueStrings
}
