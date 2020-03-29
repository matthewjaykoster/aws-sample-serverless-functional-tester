/**
 * Lambda: functional-tester-worker
 * Description: The functional-tester-worker runs a batch of tests as defined by JSON configuration, including 
 *              setup/teardown.
 * 
 * Configuration:
 * - N/a
 */

// Classes
const DataError = require('./lib/DataError');

// Libraries
const log = require('lambda-log');

// Services
const actionsService = require('./lib/actionsService');
const testBatchService = require('./lib/testBatchService');
const testService = require('./lib/testService');

// Pre-handler configuration
let _config = null;

/**
 * Initialize configuration necessary to run the lambda.
 * @param {Object} event AWS Lambda event
 * @param {Object} lambdaContext AWS Lambda context
 */
function _configureLambda(event, lambdaContext) {
    // Logging configuration
    log.options.debug = (process.env.LOG_LEVEL === 'DEBUG');
    log.options.silent = (process.env.SILENT_LOGGING === 'true') || false;

    log.debug(JSON.stringify(event));

    // Config configuration (heh)
    _config = JSON.parse(JSON.stringify(process.env));
    _config.accountId = lambdaContext.invokedFunctionArn.split(':')[4];
}

const handler = async (event, $context) => {
    let results = testBatchService.buildResultsObject();
    try {
        if (!event) throw new Error('Test Batch is undefined or empty.');

        const batchName = event.name || 'no-name-found';
        log.info(`Running test batch: ${batchName} with Test Execution ID ${event.executionId}.`);
        results.batchName = batchName;

        // Configure lambda
        log.info('-------Configuring lambda-------');
        _configureLambda(event, $context);

        // Validate Batch
        log.info('-------Validating Batch -------');
        const validationErrors = testBatchService.validateTestBatch(event);
        if (validationErrors.length) {
            results.validationErrors = validationErrors;
            results.message = 'Test Batch Failed: Configuration is invalid.';
            throw new DataError(`Test configuration contains ${validationErrors.length} validation error(s).`, validationErrors);
        }

        // Perform Test Batch setup
        if (event.setupActions && event.setupActions.length) {
            log.info('-------Test Batch Setup-------');
            const actionsResults = await actionsService.performActions(event.setupActions);
            if (!actionsResults.success) {
                results.message = 'Setup failed.';
                results.success = false;
            }
            results.setup = actionsResults;
            log.info(`Ran ${event.setupActions.length} setup actions.`);
        }

        // Run the tests
        if (results.success !== false) {
            log.info('-------Running Tests-------');
            const testsResults = await testService.runTests(event.tests);
            if (!testsResults.success) {
                results.message = 'Test(s) failed.';
                results.success = false;
            }
            results.tests = testsResults;
            log.info(`Ran ${event.tests.length} tests.`);
        }

        // Perform Test Batch teardown
        if (event.teardownActions && event.teardownActions.length) {
            log.info('-------Test Batch Teardown-------');
            const actionsResults = await actionsService.performActions(event.teardownActions);
            if (!actionsResults.success) {
                results.message = 'Teardown failed.';
                results.success = false;
            }
            results.teardown = actionsResults;
            log.info(`Ran ${event.teardownActions.length} teardown actions.`);
        }

        // Set results
        if (results.success !== false) {
            results.message = 'Test Success';
            results.success = true;
        }
    } catch (err) {
        // Log error information
        log.info('-------WARNING: GLOBAL ERROR CAUGHT-------');
        if (err && err.data) {
            log.error(err.message);
            if (err.data.length) {
                for (let message of err.data) {
                    log.info(message);
                }
            }
        } else {
            log.error(err);
        }

        // Modify the result
        results.error = err;
        if (!results.message) results.message = 'Test Batch Failure: Caught global error.';
        results.success = false;
    } finally {
        // Write test summary to logs
        log.info('-------Test Results-------');
        const resultSummary = {
            success: results.success,
            message: results.message,
            error: results.error,
            setup: {
                completed: results.setup ? results.setup.completed.length : 0,
                failed: results.setup? results.setup.failed.length : 0,
            },
            tests: {
                completed: results.tests ? results.tests.completed.length : 0,
                failed: results.tests ? results.tests.failed.length : 0,
            },
            teardown: {
                completed: results.teardown ? results.teardown.completed.length : 0,
                failed: results.teardown ? results.teardown.failed.length : 0,
            }
        };
        log.info(`Result Summary`, { resultSummary });

        return results;
    }
};

module.exports.handler = handler;