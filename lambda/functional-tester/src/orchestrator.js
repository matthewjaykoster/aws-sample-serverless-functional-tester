/**
 * Lambda: functional-tester-orchestrator
 * Description: The functional-tester-orchestrator is tasked with handling configuration, global setup/teardown, and
 *              instationation of all tests defined within the Test Configuration JSON. However, it does not actually
 *              perform any testing - that is left to the functional-tester-workers, which it instantiates.
 * 
 * Configuration:
 * - Test Configuration (not an env var): Test Configuration is contained within the file 'functional-tests.json', located
 *                                        in the root configurations directory.
 * - FT_WORKER_LAMBDA_NAME: Name of the functional-tester-worker lambda, used to execute the functional tests
 */

// Constants
const CODE_PIPELINE_JOB_FAILED = 'JobFailed';
const CONFIGURATION_FILE_REGEX = /.*functional-test.*\.json/g;
const CONFIGURATION_S3_PREFIX = 'configuration';
const RESULTS_S3_PREFIX = 'results';
const GLOBAL_SCOPE_NAME = 'Global';

// Classes
const DataError = require('./lib/DataError');

// Libraries
const AWS = require('aws-sdk');
const log = require('lambda-log');

// Services
const actionsService = require('./lib/actionsService');
const testBatchService = require('./lib/testBatchService');

// Pre-handler configuration
let _config = null;

AWS.config.update({ region: 'us-east-1' });

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

    // Naughty workaround for jest
    _config.FT_BUCKET_NAME = _config.FT_BUCKET_NAME || lambdaContext.FT_BUCKET_NAME;
    if (!_config.FT_BUCKET_NAME) throw new Error(`Missing config value 'FT_BUCKET_NAME'.`);

    _config.FT_WORKER_LAMBDA_NAME = _config.FT_WORKER_LAMBDA_NAME || lambdaContext.FT_WORKER_LAMBDA_NAME;
    if (!_config.FT_WORKER_LAMBDA_NAME) throw new Error(`Missing config value 'FT_WORKER_LAMBDA_NAME'.`);
}

/**
 * Generates a Unique ID based on the current JS timestamp.
 */
function _generateUniqueId() {
    const date = new Date();
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours() + 1}-${date.getMinutes()}-${date.getSeconds()}-${date.getMilliseconds()}`;
}

/**
 * Gets the functional test configuration from S3.
 */
async function _getTestConfig() {
    // Generate test run unique ID
    const testConfig = {
        setupActions: [],
        testBatches: [],
        teardownActions: []
    };

    try {
        // Find the files we need to pull
        const s3 = new AWS.S3();
        const params = {
            Bucket: _config.FT_BUCKET_NAME,
            Prefix: `${CONFIGURATION_S3_PREFIX}`
        };

        log.debug(`Searching for configuration files. Results will be filtered via regex: ${CONFIGURATION_FILE_REGEX}`, { params });
        const s3ListResponse = await s3.listObjectsV2(params).promise();
        const fileKeys = s3ListResponse.Contents.map(header => header.Key).filter(key => CONFIGURATION_FILE_REGEX.test(key));
        log.info(`Found ${fileKeys.length} configuration files.`);

        // Pull the files and concatenate the configurations
        const filePromises = fileKeys.map(async (key) => s3.getObject({
            Bucket: _config.FT_BUCKET_NAME,
            Key: key
        }).promise());

        const files = await Promise.all(filePromises);
        for (let file of files) {
            try {
                log.debug(`Parsing config from from: ${file.Key}`);
                const fileConfig = JSON.parse(file.Body.toString());
                if (fileConfig.setupActions && fileConfig.setupActions.length) {
                    log.debug(`Adding ${fileConfig.setupActions.length} setup actions.`);
                    testConfig.setupActions = testConfig.setupActions.concat(fileConfig.setupActions);
                }

                if (fileConfig.testBatches && fileConfig.testBatches.length) {
                    log.debug(`Adding ${fileConfig.testBatches.length} test batches.`);
                    testConfig.testBatches = testConfig.testBatches.concat(fileConfig.testBatches);
                }

                if (fileConfig.teardownActions && fileConfig.teardownActions.length) {
                    log.debug(`Adding ${fileConfig.teardownActions.length} teardown actions.`);
                    testConfig.teardownActions = testConfig.teardownActions.concat(fileConfig.teardownActions);
                }
            } catch (err) {
                log.error(`Failed to get configuration data from file: ${file.Key}`, { err });
            }
        }
    } catch (err) {
        testConfig.error = err;
        log.error('Failed to pull configuration files from S3.', { err });
    }

    log.info('Configuration created.');
    return testConfig;
}

/**
 * Sends a job result to code pipeline.
 * @param {String} codePipelineJobId CodePipeline-provided job id
 * @param {Boolean} isSuccess Whether or not the job was successful
 * @param {String} message Success/error message to write to CodePipeline
 * @param {String} lambdaInvokeId Invocation ID of the current lambda
 */
async function _putCodePipelineJobResult(codePipelineJobId, isSuccess, message, lambdaInvokeId) {
    const codePipeline = new AWS.CodePipeline();
    const params = {
        jobId: codePipelineJobId
    };

    if (isSuccess) {
        // Send success
        log.debug(`Sending success to CodePipeline job '${params.jobId}'.`);
        return await codePipeline.putJobSuccessResult(params).promise();
    }

    // Send failure
    log.debug(`Sending failure to CodePipeline job '${params.jobId}'.`);
    params.failureDetails = {
        message: message,
        type: CODE_PIPELINE_JOB_FAILED,
        externalExecutionId: lambdaInvokeId
    };
    return await codePipeline.putJobFailureResult(params).promise();
}

/**
 * Validates whether or not the test configuration has the expected structure.
 * @param {Object} testConfig Test Configuration JSON to validate.
 */
function _validateTestConfig(testConfig) {
    let validationErrors = [];

    // Validate setup actions
    if (testConfig.setupActions && testConfig.setupActions.length) {
        for (let action of testConfig.setupActions) {
            validationErrors = validationErrors.concat(actionsService.validateAction(action, GLOBAL_SCOPE_NAME));
        }
    }

    // Validate test batches
    if (testConfig.testBatches && testConfig.testBatches.length) {
        for (let batch of testConfig.testBatches) {
            validationErrors = validationErrors.concat(testBatchService.validateTestBatch(batch));
        }
    } else {
        validationErrors.push('Test configuration has no test batches.');
    }

    // Validate teardown actions
    if (testConfig.teardownActions && testConfig.teardownActions.length) {
        for (let action of testConfig.teardownActions) {
            validationErrors = validationErrors.concat(actionsService.validateAction(action, GLOBAL_SCOPE_NAME));
        }
    }

    return validationErrors;
}

/**
 * Writes the test result object into S3.
 * @param {Object} results 
 */
async function _writeResultToS3(results) {
    // Write the file
    const s3 = new AWS.S3();
    const params = {
        Bucket: _config.FT_BUCKET_NAME,
        Key: `${RESULTS_S3_PREFIX}/${results.id}/results.json`,
        Body: JSON.stringify(results),
        ContentType: 'application/json'
    };

    log.debug(`Writing results. Bucket: ${params.Bucket}. Key: ${params.Key}.`);
    await s3.putObject(params).promise();
}

const handler = async (event, $context) => {
    const results = {
        id: _generateUniqueId(),
        config: undefined,
        configValidationErrors: undefined,
        success: undefined,
        error: undefined,
        message: undefined,
        setup: undefined,
        testBatches: undefined,
        teardown: undefined,
    };
    try {
        log.info(`Running test suite with Test Execution ID '${results.id}'.`);

        // Configure lambda
        log.info('-------Configuring lambda-------');
        _configureLambda(event, $context);

        // Get config from S3 and validate it
        log.info('-------Configuration -------');
        const testConfig = await _getTestConfig();
        results.config = testConfig;
        if (testConfig.error) {
            results.message = 'Test Failure: Failed to get configuration from S3.';
            throw testConfig.error;
        }

        const validationErrors = _validateTestConfig(testConfig);
        if (validationErrors.length) {
            results.configValidationErrors = validationErrors;
            results.message = 'Test Failed: Configuration is invalid.';
            throw new DataError(`Test configuration contains ${validationErrors.length} validation error(s).`, validationErrors);
        }

        // Perform global setup
        if (testConfig.setupActions && testConfig.setupActions.length) {
            log.info('-------Global Setup-------');
            const actionsResults = await actionsService.performActions(testConfig.setupActions);
            if (!actionsResults.success) {
                results.message = 'Setup failed.';
                results.success = false;
            }
            results.setup = actionsResults;
            log.info(`Ran ${testConfig.setupActions.length} setup action(s).`);
        }

        // Invoke one worker lambda per test batch, gather results. Skip if setup failed.
        if (results.success !== false) {
            log.info('-------Running Test Batches-------');
            const batchesResults = await testBatchService.delegateExecutions(testConfig.testBatches, results.id, _config.FT_WORKER_LAMBDA_NAME);
            if (!batchesResults.success) {
                results.message = 'One or more test batches failed.';
                results.success = false;
            }
            results.testBatches = batchesResults;
            log.info(`Ran ${testConfig.testBatches.length} test batch(es).`);
        }

        // Perform global teardown
        if (testConfig.teardownActions && testConfig.teardownActions.length) {
            log.info('-------Global Teardown-------');
            const actionsResults = await actionsService.performActions(testConfig.teardownActions);
            if (!actionsResults.success) {
                results.message = 'Teardown failed.';
                results.success = false;
            }
            results.teardown = actionsResults;
            log.info(`Ran ${testConfig.teardownActions.length} teardown action(s).`);
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
            if (err.data && Array.isArray(err.data)) {
                for (let message of err.data) log.info(message);
            }
        } else {
            log.error(err);
        }

        // Modify the result
        results.error = err;
        if (!results.message) results.message = 'Test Failure: Caught global error.';
        results.success = false;
    } finally {
        // Write test results to S3 (including final configuration)
        log.info('-------Test Results-------');
        try {
            const resultSummary = {
                success: results.success,
                message: results.message,
                error: results.error,
                setup: {
                    completed: results.setup ? results.setup.completed.length : 0,
                    failed: results.setup ? results.setup.failed.length : 0,
                },
                testBatches: {
                    completed: results.testBatches ? results.testBatches.completed.length : 0,
                    failed: results.testBatches ? results.testBatches.failed.length : 0,
                },
                teardown: {
                    completed: results.teardown ? results.teardown.completed.length : 0,
                    failed: results.teardown ? results.teardown.failed.length : 0,
                },
            };
            log.info(`Result Summary`, { resultSummary });
            await _writeResultToS3(results);
        } catch (err) {
            log.error('Failed to write results to S3.', { err });
        }

        // If running in the CodePipeline context, put success/failure
        if (event && event["CodePipeline.job"] && event["CodePipeline.job"].id) {
            log.info('-------CodePipeline Results-------');
            try {
                await _putCodePipelineJobResult(event["CodePipeline.job"].id, results.success, results.message, $context.invokeid);
            } catch (err) {
                log.error('Failed to write CodePipeline results.', { err });
            }
        }

        return results;
    }
};

module.exports.handler = handler;