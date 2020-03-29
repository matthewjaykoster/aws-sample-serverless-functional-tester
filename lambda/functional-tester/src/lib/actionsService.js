/**
 * Description: The actions service handles routing of functional-tester actions into the various action
 *              exeuctors which perform the action.
 */

// Constants
const COMPARISON_TYPES = ['conatins-same-values', 'equals'];
const KNOWN_ACTIONS = {
    awssdk: 'awsSdk',
    dynamodelete: 'dynamoDelete',
    dynamoget: 'dynamoGet',
    dynamoput: 'dynamoPut',
    kinesisputrecord: 'kinesisPutRecord',
    kinesisputrecords: 'kinesisPutRecords',
    lambdainvoke: 'lambdaInvoke',
    querygraphqlapi: 'queryGraphQlApi',
};

// Classes
const DataError = require('./DataError');

// Libaries
const deepEqual = require('deep-equal');
const log = require('lambda-log');

// Services
const utilities = require('./utilities');

/**
 * Compares two values, ensuring that that are exactly equal.
 * @param {*} toValidate Value to validate
 * @param {*} expected Expected value
 */
function _compareByEquality(toValidate, expected) {
    if (utilities.isPrimitive(toValidate) || utilities.isPrimitive(expected)) return toValidate === expected;  // Handle primitives

    return deepEqual(toValidate, expected, { strict: true });
}

/**
 * Compares two values, ensuring the passed value has the same properties/values as the expected value. Primitives are
 * compared directly.
 * @param {*} toValidate Value to validate
 * @param {*} expected Expected value
 * @returns {Boolean} true, if the value contains the expected properties and values. False otherwise.
 */
function _hasExpectedPropsAndVals(toValidate, expected) {
    if (utilities.isPrimitive(toValidate) || utilities.isPrimitive(expected)) return toValidate === expected;   // Handle primitives
    if (Object.keys(toValidate).length === 0 && Object.keys(expected).length === 0) return true;                // Handle empty objects, empty arrays

    // Crawl the object/array
    let isSame = false;
    for (let key in expected) {
        isSame = _hasExpectedPropsAndVals(toValidate[key], expected[key]);
        if (!isSame) break;
    }

    return isSame;
}

/**
 * Validates whether or not an object is valid by comparing it against an expected result.
 * @param {*} toValidate Value to validate
 * @param {*} expected Expected value. toValidate should match this value according to the comparisonType.
 * @param {String} comparisonType Type of comparison
 * @returns {Boolean} true, if the value to validate meets the expectation. False otherwise.
 */
function _isExpected(toValidate, expected, comparisonType) {
    comparisonType = comparisonType.toLowerCase();

    switch (comparisonType) {
        case 'equals':
            log.debug('Comparing by deep equality.');
            return _compareByEquality(toValidate, expected);
        default:
            log.debug('Comparing by values.');
            return _hasExpectedPropsAndVals(toValidate, expected);
    }
}

/**
 * Perform a functional test action.
 * @param {Object} action A functional test action, containing minimally a "type" string and a "parameters" object.
 * @returns {Object} The action, with result information
 */
async function performAction(action) {
    if (!action || !action.result || !action.result.failedAttempts || action.result.failedAttempts.length === 0) {
        const validationErrors = validateAction(action);
        if (validationErrors.length) {
            const error = new DataError('Failed to perform action. Action contains validation errors.', validationErrors);
            if (!action) action = {};
            action.result = {
                error,
                success: false
            };
            return action;
        }
    }

    // Execute the action
    if (!action.result) action.result = {};
    if (!action.result.failedAttempts) action.result.failedAttempts = [];

    const attemptResult = {};
    try {
        log.debug(`Running action ${action.type}.`);

        // Wait the configured initial period, but only on the first attempt
        if (action.result.failedAttempts.length === 0 && action.initialWaitMs) {
            log.debug(`Initial wait period: ${action.initialWaitMs}ms.`);
            await utilities.sleep(action.initialWaitMs);
        }

        const actionType = action.type.toLowerCase();
        const actionExecutor = require(`./actions/${KNOWN_ACTIONS[actionType]}`);
        const result = await actionExecutor.execute(action.params);
        attemptResult.response = result;

        if (action.expectedResponse) {
            // Validate expected responses
            log.debug('Validating action result against expected response.');
            attemptResult.success = _isExpected(attemptResult.response, action.expectedResponse.response, action.expectedResponse.comparisonType);
            if (!attemptResult.success) attemptResult.message = 'Comparison with expected response failed.';
        } else if (action.expectedError) {
            // If success and we have an expected error, fail
            log.debug('Action succeeded, but expected an error.');
            attemptResult.success = false;
            attemptResult.message = 'Action succeeded, but expected an error.';
        } else {
            attemptResult.success = true;
        }
    } catch (err) {
        attemptResult.error = err;

        if (action.expectedError) {
            // Validate expected errors
            log.debug(`Validating action error against expected error.`);
            attemptResult.success = _isExpected(err, action.expectedError.error, action.expectedError.comparisonType);
            if (!attemptResult.success) attemptResult.message = 'Comparison with expected error failed.';
        } else {
            log.error('Unexpected error executing action.', { err });
            attemptResult.message = 'Unexpected error executing action.';
            attemptResult.success = false;
        }
    } finally {
        // No retries for success, undefined configuration, or already at the max number of retries
        if (attemptResult.success === true || !action.maxNumRetries || action.result.failedAttempts.length >= action.maxNumRetries) {
            action.result = Object.assign(action.result, attemptResult);
            return action;
        }

        // Handle retries
        log.debug('Action failed. Retrying...');
        action.result.failedAttempts.push(attemptResult);

        if (action.waitBetweenRetriesMs) {
            log.debug(`Waiting before retry: ${action.waitBetweenRetriesMs}ms.`);
            await utilities.sleep(action.waitBetweenRetriesMs);
        }

        return await performAction(action);
    }
}

/**
 * Perform a set of actions using the specified type and parameters.
 * @param {Object} actions An array of functional test actions, each containing minimally a "type" string and a "parameters" object.
 * @returns {Object} A set of result data about the actions
 */
async function performActions(actions) {
    const results = {
        completed: [],
        failed: [],
        success: true
    };

    if (actions && actions.length) {
        for (let action of actions) {
            const actionResult = await performAction(action);

            if (!actionResult.result || !actionResult.result.success) {
                results.failed.push(actionResult);
                results.success = false;
            } else {
                results.completed.push(actionResult);
            }
        }
    }

    return results;
}

/**
 * Validate an action configuration.
 * @param {Object} action Action configuration
 * @param {String} parentScopeName Current action "scope" (generally the name of the executing lambda, test batch, or test)
 * @returns {Array<String>} List of validation errors.
 */
function validateAction(action, parentScopeName) {
    const errors = [];
    if (!action) {
        errors.push(utilities.buildScopedMessage('Action is null or undefined.', parentScopeName));
        return errors;
    }

    if (!action.type) {
        errors.push(utilities.buildScopedMessage('Action\'s actionType is null or undefined.', parentScopeName));
        return errors;
    }

    // Check whether the configuration is in the known list of options.
    if (!KNOWN_ACTIONS[action.type.toLowerCase()])
        errors.push(utilities.buildScopedMessage(`Received actionType '${action.type}', but did not find an action executor. Valid executors: ${Object.keys(KNOWN_ACTIONS).join(', ')}`, parentScopeName));

    // Check that expected responses are well-formed (if existing)
    if (action.expectedResponse && !action.expectedResponse.response) {
        errors.push(utilities.buildScopedMessage(`Action has expected response config, but no 'response' property.`, parentScopeName));
    }

    if (action.expectedError && !action.expectedError.error) {
        errors.push(utilities.buildScopedMessage(`Action has expected error config, but no 'error' property.`, parentScopeName));
    }

    // Check that expected responses and errors have proper comparison types
    if (action.expectedResponse && !COMPARISON_TYPES.includes(action.expectedResponse.comparisonType)) {
        errors.push(utilities.buildScopedMessage(`Action has expected response with invalid comparison type '${action.expectedResponse.comparisonType}'. Valid comparison types: ${COMPARISON_TYPES.join(', ')}`, parentScopeName));
    }

    if (action.expectedError && !COMPARISON_TYPES.includes(action.expectedError.comparisonType)) {
        errors.push(utilities.buildScopedMessage(`Action has expected error with invalid comparison type '${action.expectedError.comparisonType}'. Valid comparison types: ${COMPARISON_TYPES.join(', ')}`, parentScopeName));
    }

    // Check that only one of (expected response, expected error) is defined
    if (action.expectedError && action.expectedResponse) {
        errors.push(utilities.buildScopedMessage(`Action has both expected response and expected error defined.`, parentScopeName));
    }

    // Check retry properties
    if (action.initialWaitMs && (Number.isNaN(parseInt(action.initialWaitMs)) || parseInt(action.initialWaitMs) < 0)) {
        errors.push(utilities.buildScopedMessage('initialWaitMs must be a non-negative number if defined.', parentScopeName));
    }

    if (action.maxNumRetries && (Number.isNaN(parseInt(action.maxNumRetries)) || parseInt(action.maxNumRetries) < 0)) {
        errors.push(utilities.buildScopedMessage('maxNumRetries must be non-negative number if defined.', parentScopeName));
    }

    if (action.waitBetweenRetriesMs && (Number.isNaN(parseInt(action.waitBetweenRetriesMs)) || parseInt(action.waitBetweenRetriesMs) < 0)) {
        errors.push(utilities.buildScopedMessage('waitBetweenRetriesMs must be non-negative number if defined.', parentScopeName));
    }

    // TODO - actionType-specific validation

    return errors;
}

module.exports.performAction = performAction;
module.exports.performActions = performActions;
module.exports.validateAction = validateAction;