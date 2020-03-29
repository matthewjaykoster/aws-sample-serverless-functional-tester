/**
 * Description: The test service handles execution and validation of functional tests.
 */

// Classes
const DataError = require('./DataError');

// Libaries
const log = require('lambda-log');

// Services
const actionsService = require('./actionsService');
const utilities = require('./utilities');

/**
 * Builds a test batch results object.
 * @param {String} testName Test name
 * @param {Boolean} success Success or not, as true or false.
 * @param {String} error Result error
 * @param {String} message Result message
 * @param {Object} setup Setup results, including action properties "completed" and "failed".
 * @param {Object} testActions Test action results
 * @param {Object} teardown Teardown results, including action properties "completed" and "failed".
 */
function _buildResultsObject(testName, success, error, message, setup, testActions, teardown) {
    return {
        testName,
        success,
        error,
        message,
        setup,
        testActions,
        teardown
    };
}

/**
 * Runs a test
 * @param {Object} test Test configuration
 */
async function runTest(test) {
    const testName = test ? test.name : 'no-name-found';
    log.debug(`Running test '${testName}.'`);
    const results = _buildResultsObject(testName, true, null, null, null, null, null);

    // Validation
    const validationErrors = validateTest(test);
    if (validationErrors.length) {
        const error = new DataError('Failed to run test. Test contains validation errors.', validationErrors);
        results.error = error;
        results.message = 'Failed to run test. Test contains validation errors.';
        results.success = false;
        return results;
    }

    // Setup
    log.debug(`Running setup.`);
    const setupResults = await actionsService.performActions(test.setupActions);
    if (!setupResults.success) {
        log.debug(`Setup failed.`);
        results.message = 'Setup failed';
        results.success = false;
    }
    results.setup = setupResults;

    // Test Actions
    if (results.success !== false) {
        log.debug(`Running test actions.`);
        const testActionResults = await actionsService.performActions(test.testActions);
        if (!testActionResults.success) {
            log.debug(`Test actions failed.`);
            results.message = 'Test actions failed';
            results.success = false;
        }
        results.testActions = testActionResults;
    }

    // Teardown
    log.debug(`Running teardown.`);
    const teardownResults = await actionsService.performActions(test.teardownActions);
    if (!teardownResults.success) {
        log.debug(`Teardown failed.`);
        results.message = 'Teardown failed';
        results.success = false;
    }
    results.teardown = teardownResults;

    if (!results.message) results.message = 'Test complete.';
    log.debug(`Result message: ${results.message}`);
    return results;
}

/**
 * Runs a set of tests
 * @param {Object} tests Test configurations
 */
async function runTests(tests) {
    const results = {
        completed: [],
        failed: [],
        success: true
    };

    if (tests && tests.length) {
        for (let test of tests) {
            const testResult = await runTest(test);

            if (!testResult.success) {
                results.failed.push(testResult);
                results.success = false;
            } else {
                results.completed.push(testResult);
            }
        }
    }

    return results;
}

/**
 * Validate a test configuration.
 * @param {Object} test Test configuration
 * @param {String} parentScopeName Current test "scope" (generally the name of the executing test batch)
 * @returns {Array<String>} List of validation errors.
 */
function validateTest(test, parentScopeName) {
    let errors = [];
    const testName = (test || {}).name || 'name-not-found';
    const name = parentScopeName ? `${parentScopeName}|Test:${testName}` : `Test:${testName}`;
    if (!test) {
        errors.push(utilities.buildScopedMessage('Test is null or undefined.', name));
        return errors;
    }

    if (!test.name) {
        errors.push(utilities.buildScopedMessage('Test\'s name is null or undefined.', name));
    }

    if (!test.description) {
        errors.push(utilities.buildScopedMessage('Test\'s description is null or undefined.', name));
    }

    // Validate setup actions
    if (test.setupActions && test.setupActions.length) {
        for (let action of test.setupActions) {
            errors = errors.concat(actionsService.validateAction(action, name));
        }
    }

    // Validate tests
    if (test.testActions && test.testActions.length) {
        for (let action of test.testActions) {
            errors = errors.concat(actionsService.validateAction(action, name));
        }
    } else {
        errors.push(utilities.buildScopedMessage('Test has no test actions.', name));
    }

    // Validate teardown actions
    if (test.teardownActions && test.teardownActions.length) {
        for (let action of test.teardownActions) {
            errors = errors.concat(actionsService.validateAction(action, name));
        }
    }

    return errors;
}

module.exports.runTest = runTest;
module.exports.runTests = runTests;
module.exports.validateTest = validateTest;