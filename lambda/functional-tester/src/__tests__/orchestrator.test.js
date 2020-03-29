// Constants
const mockContext = {
    account: '983054836469',
    alias: 'test',
    invokedFunctionArn: 'aws:arn:lambda:us-east-1:983054836469',
    functionName: 'test-functional-test-orchestrator',
    FT_BUCKET_NAME: 'pt-functional-tester-12345-test',
    FT_WORKER_LAMBDA_NAME: 'test-functional-tester-worker'
};

// Data
const events = require('./events.json');
const responses = require('./responses');

// Libraries
let AWSSDK = require('aws-sdk');
let AWS = require('aws-sdk-mock');

// Services
let actionsService = require('../lib/actionsService');
let testBatchService = require('../lib/testBatchService');

let orchestrator = require('../orchestrator.js');
describe('functional-tester-orchestrator', () => {
    beforeEach(() => {
        // Reload modules so I can actually mock them because node's global space caching makes tests ANNOYING AS @#%&
        AWSSDK = require('aws-sdk');
        AWS = require('aws-sdk-mock');
        AWS.setSDKInstance(AWSSDK);

        _setupS3OrchestratorConfigMock(responses.AWS.S3.getObject.validTestConfiguration);

        AWS.mock('S3', 'putObject', function (params, callback) {
            callback(null, 'Put Success');
        });

        AWS.mock('CodePipeline', 'putJobSuccessResult', function (params, callback) {
            callback(null, 'Put Success');
        });

        AWS.mock('CodePipeline', 'putJobFailureResult', function (params, callback) {
            callback(null, 'Put Success');
        });

        actionsService = require('../lib/actionsService');
        actionsService.validateAction = jest.fn(() => []);
        actionsService.performActions = jest.fn(() => responses.actionsService.actionsSuccess);

        testBatchService = require('../lib/testBatchService');
        testBatchService.validateTestBatch = jest.fn(() => []);
        testBatchService.delegateExecutions = jest.fn(() => responses.testBatchService.testBatchesSuccess);

        orchestrator = require('../orchestrator.js');
    });

    afterEach(() => {
        _teardownS3OrchestratorConfigMock();
        AWS.restore('S3', 'putObject');
        AWS.restore('CodePipeline', 'putJobSuccessResult');
        AWS.restore('CodePipeline', 'putJobFailureResult');
        jest.resetModules();
    });

    describe('handler()', () => {
        /**
         * The orchestrator uses the input lambda event only to determine CodePipeline functinality - all other configuration
         * comes from S3, so we have to mock all of our events using AWS SDK Mock.
         */
        test('should return an error failure given missing configuration values', async () => {
            const missingBucketContext = JSON.parse(JSON.stringify(mockContext));
            delete missingBucketContext.FT_BUCKET_NAME;
            const results = await orchestrator.handler(null, missingBucketContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Test Failure: Caught global error.');
            expect(results.error).toBeDefined();
            expect(results.error.message).toEqual(`Missing config value 'FT_BUCKET_NAME'.`);

            const missingLambdaContext = JSON.parse(JSON.stringify(mockContext));
            delete missingLambdaContext.FT_WORKER_LAMBDA_NAME;
            const resultsPartDeux = await orchestrator.handler(null, missingLambdaContext);
            expect(resultsPartDeux).toBeDefined();
            expect(resultsPartDeux.success).toEqual(false);
            expect(resultsPartDeux.message).toEqual('Test Failure: Caught global error.');
            expect(resultsPartDeux.error).toBeDefined();
            expect(resultsPartDeux.error.message).toEqual(`Missing config value 'FT_WORKER_LAMBDA_NAME'.`);
        });

        test('should return an error failure given configuration get fails', async () => {
            _teardownS3OrchestratorConfigMock();
            _setupS3OrchestratorConfigMock(undefined, new Error('This was a total failure.'));

            const results = await orchestrator.handler(null, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Test Failure: Failed to get configuration from S3.');
            expect(results.error).toBeDefined();
            expect(results.error.message).toEqual('This was a total failure.');
        });

        test('should return an error failure and report to CodePipeine given configuration get fails and a CodePipeline ID', async () => {
            _teardownS3OrchestratorConfigMock();
            _setupS3OrchestratorConfigMock(undefined, new Error('This was a total failure.'));
            
            const putJobFailureMock = jest.fn();
            AWS.restore('CodePipeline', 'putJobFailureResult');
            AWS.mock('CodePipeline', 'putJobFailureResult', function (params, callback) {
                putJobFailureMock();
                callback(null, 'Put Success');
            });
            
            const results = await orchestrator.handler(events.orchestrator.codePipeline, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Test Failure: Failed to get configuration from S3.');
            expect(results.error).toBeDefined();
            expect(results.error.message).toEqual('This was a total failure.');
            expect(putJobFailureMock).toHaveBeenCalledTimes(1);
        });

        test('should return an error failure given config validation fails', async () => {
            _teardownS3OrchestratorConfigMock();
            _setupS3OrchestratorConfigMock(responses.AWS.S3.getObject.invalidTestConfiguration);

            const results = await orchestrator.handler(null, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Test Failed: Configuration is invalid.');
            expect(results.error).toBeDefined();
            expect(results.error.message).toEqual('Test configuration contains 1 validation error(s).');
            expect(results.error.data).toBeDefined();
            expect(results.error.data.length).toEqual(1);
        });

        test('should return an error failure given setup, a test batch, or teardown throws an error', async () => {
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsSuccess)
                .mockRejectedValueOnce({ message: 'this-is-an-error' });

            const results = await orchestrator.handler(null, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Test Failure: Caught global error.');
            expect(results.error).toBeDefined();
            expect(results.error.message).toEqual('this-is-an-error');
            expect(results.setup).toBeDefined();
            expect(results.setup.success).toEqual(true);
            expect(results.testBatches).toBeDefined();
            expect(results.testBatches.success).toEqual(true);
        });

        test('should return a completed failure and not run test batches given setup fails', async () => {
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsFailed)
                .mockReturnValueOnce(responses.actionsService.actionsSuccess);

            const results = await orchestrator.handler(null, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Setup failed.');
            expect(results.setup).toBeDefined();
            expect(results.setup.success).toEqual(false);
            expect(results.testBatches).toBeUndefined();
            expect(results.teardown).toBeDefined();
            expect(results.teardown.success).toEqual(true);
        });

        test('should return a completed failure given at least one test batch fails', async () => {
            testBatchService.delegateExecutions = jest.fn()
                .mockReturnValueOnce(responses.testBatchService.testBatchesFailed);

            const results = await orchestrator.handler(null, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('One or more test batches failed.');
            expect(results.setup).toBeDefined();
            expect(results.setup.success).toEqual(true);
            expect(results.testBatches).toBeDefined();
            expect(results.testBatches.success).toEqual(false);
            expect(results.teardown).toBeDefined();
            expect(results.teardown.success).toEqual(true);
        });

        test('should return a completed failure given teardown fails', async () => {
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsSuccess)
                .mockReturnValueOnce(responses.actionsService.actionsFailed);

            const results = await orchestrator.handler(null, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Teardown failed.');
            expect(results.setup).toBeDefined();
            expect(results.setup.success).toEqual(true);
            expect(results.testBatches).toBeDefined();
            expect(results.testBatches.success).toEqual(true);
            expect(results.teardown).toBeDefined();
            expect(results.teardown.success).toEqual(false);
        });


        test('should return a completed success given a valid test configuration', async () => {
            const results = await orchestrator.handler(null, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(true);
            expect(results.message).toEqual('Test Success');
            expect(results.error).toBeUndefined();
            expect(results.setup).toBeDefined();
            expect(results.setup.success).toEqual(true);
            expect(results.testBatches).toBeDefined();
            expect(results.testBatches.success).toEqual(true);
            expect(results.teardown).toBeDefined();
            expect(results.teardown.success).toEqual(true);
        });

        test('should return a completed success given a valid test configuration with no setup/teardown', async () => {
            _teardownS3OrchestratorConfigMock();
            _setupS3OrchestratorConfigMock(responses.AWS.S3.getObject.validTestConfigurationNoSetupNoTeardown);

            const results = await orchestrator.handler(null, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(true);
            expect(results.message).toEqual('Test Success');
            expect(results.error).toBeUndefined();
            expect(results.setup).toBeUndefined();
            expect(results.testBatches).toBeDefined();
            expect(results.testBatches.success).toEqual(true);
            expect(results.teardown).toBeUndefined();
        });

        test('should return a completed success and report to CodePipeine given a valid test configuration and CodePipeline ID', async () => {
            const putJobSuccessMock = jest.fn();
            AWS.restore('CodePipeline', 'putJobSuccessResult');
            AWS.mock('CodePipeline', 'putJobSuccessResult', function (params, callback) {
                putJobSuccessMock();
                callback(null, 'Put Success');
            });
            
            const results = await orchestrator.handler(events.orchestrator.codePipeline, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(true);
            expect(results.message).toEqual('Test Success');
            expect(results.error).toBeUndefined();
            expect(results.setup).toBeDefined();
            expect(results.setup.success).toEqual(true);
            expect(results.testBatches).toBeDefined();
            expect(results.testBatches.success).toEqual(true);
            expect(results.teardown).toBeDefined();
            expect(results.teardown.success).toEqual(true);
            expect(putJobSuccessMock).toHaveBeenCalledTimes(1);
        });
    });
});

/**
 * Sets up the AWS SDK S3 Mock to return functional test config/errors properly. Should be called ONLY after the
 * sdk mock is setup (generally in beforeEach).
 * @param {Object} ftConfig Functional test config object
 * @param {*} error Functional test config error
 */
function _setupS3OrchestratorConfigMock(ftConfig, error) {
    AWS.mock('S3', 'listObjectsV2', function (params, callback) {
        callback(null, responses.AWS.S3.listObjectsV2.ftConfigFile);
    });

    AWS.mock('S3', 'getObject', function (params, callback) {
        callback(error, ftConfig);
    });
}

/**
 * Restores the AWS SDK S3 Mock used to return function test config/errors properly.
 */
function _teardownS3OrchestratorConfigMock() {
    AWS.restore('S3', 'listObjectsV2');
    AWS.restore('S3', 'getObject');
}