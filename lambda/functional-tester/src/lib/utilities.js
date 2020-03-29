/**
 * Description: Set of common, miscellaneous functions in use across multiple JS files.
 */

/**
 * Builds a message of the form "{scope}|{message}". If not scope is provided, leaves message unmutated.
 * @param {String} message Message
 * @param {String} scope Value gets prepended to message
 */
function buildScopedMessage(message, scope) {
    if (scope) return `${scope}|${message}`;

    return message;
}

/**
 * Checks whether or not a value is a primitive.
 * @param {*} val Value to test
 */
function isPrimitive(val) {
    return (val !== Object(val));
}

/**
 * If awaited, causes the program to sleep for a specified period of time.
 * @param {Number} ms Number of milliseconds to sleep for
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.buildScopedMessage = buildScopedMessage;
module.exports.isPrimitive = isPrimitive;
module.exports.sleep = sleep;