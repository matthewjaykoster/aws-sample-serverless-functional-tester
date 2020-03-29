/**
 * Description: The test batch service handles execution and validation of functional test batches.
 */

// Constants
const LOG_TAIL_TYPE = 'None';
const LAMBDA_ALIAS = 'live';

// Classes
const DataError = require('./DataError');

// Libaries
const AWS = require('aws-sdk');
const log = require('lambda-log');

// Services
const actionsService = require('./actionsService');
const testService = require('./testService');
const utilities = require('./utilities');

/**
 * Builds a test batch results object.
 * @param {String} batchName Batch name
 * @param {Boolean} success Success or not, as true or false.
 * @param {String} error Result error
 * @param {String} message Result message
 * @param {Object} setup Setup results, including action properties "completed" and "failed".
 * @param {Object} tests Test results, including action properties "completed" and "failed".
 * @param {Object} teardown Teardown results, including action properties "completed" and "failed".
 */
function buildResultsObject(batchName, success, error, message, setup, tests, teardown) {
    return {
        batchName,
        success,
        error,
        message,
        setup,
        tests,
        teardown
    }
}

/**
 * Runs a batch of tests by invoking one instance of the functional-tester-worker lambda per batch.
 * @param {Object} batch Test batch configuration
 * @param {String} workerFunctionName Lambda which will execute the test batch
 */
async function delegateExecution(batch, workerFunctionName) {
    const batchName = batch ? batch.name : 'no-name-found';
    const validationErrors = validateTestBatch(batch);
    if (validationErrors.length) {
        const error = new DataError('Failed to run test batch. Test batch contains validation errors.', validationErrors);
        return buildResultsObject(
            batchName,
            false,
            error,
            'Test batch contains validation errors.',
            { completed: [], failed: [] },
            { completed: [], failed: [] },
            { completed: [], failed: [] }
        );
    }

    // Execute the action
    try {
        log.debug(`Executing ${batch.name} using ${workerFunctionName}.`);

        const lambda = new AWS.Lambda();
        const params = {
            FunctionName: workerFunctionName,
            LogType: LOG_TAIL_TYPE,
            Payload: JSON.stringify(batch),
            Qualifier: LAMBDA_ALIAS
        };
        const executionResult = await lambda.invoke(params).promise();
        return JSON.parse(executionResult.Payload);
    } catch (err) {
        log.error('Unexpected error executing batch.', { err });

        return buildResultsObject(
            batchName,
            false,
            err,
            'Unexpected error executing batch.',
            { completed: [], failed: [] },
            { completed: [], failed: [] },
            { completed: [], failed: [] }
        );
    }
}

/**
 * Runs batches of tests by invoking one instance of the functional-tester-worker lambda per batch.
 * @param {Object} batches Test batch configurations
 * @param {String} testResultsId Unique ID for the test suite execution
 * @param {String} workerFunctionName Lambda which will execute the test batch
 */
async function delegateExecutions(batches, testResultsId, workerFunctionName) {
    const results = {
        completed: [],
        failed: [],
        success: true
    };

    if (batches && batches.length) {
        for (let batch of batches) {
            if (testResultsId) batch.executionId = testResultsId;

            const batchResult = await delegateExecution(batch, workerFunctionName);
            if (!batchResult.success) {
                results.failed.push(batchResult);
                results.success = false;
            } else {
                results.completed.push(batchResult);
            }
        }
    }

    return results;
}

/**
 * Validate a test batch configuration.
 * @param {Object} batch Test batch configuration
 * @returns {Array<String>} List of validation errors.
 */
function validateTestBatch(batch) {
    const batchName = (batch || {}).name || 'name-not-found';
    const scope = `Batch:${batchName || 'name-not-found'}`;

    let errors = [];
    if (!batch) {
        errors.push(utilities.buildScopedMessage('Test Batch is null or undefined.', scope));
        return errors;
    }

    if (!batch.name) {
        errors.push(utilities.buildScopedMessage('Batch\'s name is null or undefined.', scope));
    }

    if (!batch.description) {
        errors.push(utilities.buildScopedMessage('Batch\'s description is null or undefined.', scope));
    }

    // Validate setup actions
    if (batch.setupActions && batch.setupActions.length) {
        for (let action of batch.setupActions) {
            errors = errors.concat(actionsService.validateAction(action, scope));
        }
    }

    // Validate tests
    if (batch.tests && batch.tests.length) {
        for (let test of batch.tests) {
            errors = errors.concat(testService.validateTest(test, scope));
        }
    } else {
        errors.push(utilities.buildScopedMessage('Batch has no tests.', scope));
    }

    // Validate teardown actions
    if (batch.teardownActions && batch.teardownActions.length) {
        for (let action of batch.teardownActions) {
            errors = errors.concat(actionsService.validateAction(action, scope));
        }
    }

    return errors;
}

module.exports.buildResultsObject = buildResultsObject;
module.exports.delegateExecution = delegateExecution;
module.exports.delegateExecutions = delegateExecutions;
module.exports.validateTestBatch = validateTestBatch;