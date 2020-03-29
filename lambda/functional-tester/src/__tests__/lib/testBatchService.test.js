// Constants
const LAMBDA_NAME = 'test_LambdaName';

// Data
const events = require('../events.json');
const responses = require('../responses');

// Libraries
let AWSSDK = require('aws-sdk');
let AWS = require('aws-sdk-mock');

// Services
let actionsService = require('../../lib/actionsService');
let testService = require('../../lib/testService');

let testBatchService = require('../../lib/testBatchService');
describe('testBatchService', () => {
    
    beforeEach(() => {
        // Reload modules so I can actually mock them because node's global space caching makes tests ANNOYING AS @#%&
        AWSSDK = require('aws-sdk');
        AWS = require('aws-sdk-mock');
        AWS.setSDKInstance(AWSSDK);
        AWS.mock('Lambda', 'invoke', function (params, callback) {
            callback(null, responses.worker.results);
        });

        testBatchService = require('../../lib/testBatchService');

        testService = require('../../lib/testService');
        testService.validateTest = jest.fn(() => responses.testService.noValidationErrors);

        actionsService = require('../../lib/actionsService');
        actionsService.validateAction = jest.fn(() => responses.actionsService.noValidationErrors);
    });
    
    afterEach(() => {
        AWS.restore('Lambda', 'invoke');
        jest.resetModules();
    });

    describe('buildResultsObject()', () => {
        test('should return an object with the input format', () => {
            const results = testBatchService.buildResultsObject('name', true, 'this error', 'message', {}, [], 23);
            expect(results).toEqual({
                batchName: 'name',
                success: true,
                error: 'this error',
                message: 'message',
                setup: {},
                tests: [],
                teardown: 23
            });
        });
    });

    describe('delegateExecution()', () => {
        test('should return failure given an invalid test batch', async () => {
            const results = await testBatchService.delegateExecution(events.testBatchService.testBatchMissingThings, LAMBDA_NAME);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.error).toBeDefined();
            expect(results.error.message).toEqual('Failed to run test batch. Test batch contains validation errors.');
            expect(results.error.data).toBeDefined();
            expect(results.error.data.length).toEqual(3);
        });

        test('should return success given a valid, successful test batch', async () => {
            const results = await testBatchService.delegateExecution(events.testBatchService.testBatchValid, LAMBDA_NAME);
            expect(results).toBeDefined();
            expect(results.success).toEqual(true);
            expect(results.message).toEqual('Test Success');
            expect(results.error).toBeNull();
        });

        test('should return failure given a valid, failed test batch', async () => {
            AWS.restore('Lambda', 'invoke');
            AWS.mock('Lambda', 'invoke', function (params, callback) {
                callback(null, responses.worker.resultsError);
            });

            const results = await testBatchService.delegateExecution(events.testBatchService.testBatchValid, LAMBDA_NAME);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Failed to run test. Test contains validation errors.');
            expect(results.error).toBeDefined();
        });

        test('should return failure given a valid test batch which throws', async () => {
            AWS.restore('Lambda', 'invoke');
            AWS.mock('Lambda', 'invoke', function (params, callback) {
                callback('Something went wrong dood.');
            });

            const results = await testBatchService.delegateExecution(events.testBatchService.testBatchValid, LAMBDA_NAME);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.error).toEqual('Something went wrong dood.');
            expect(results.message).toEqual('Unexpected error executing batch.');
        });
    });

    describe('delegateExecutions()', () => {
        test('should return failure given at least one test batch fails', async () => {
            const results = await testBatchService.delegateExecutions([
                events.testBatchService.testBatchValid,
                events.testBatchService.testBatchMissingThings
            ], null, LAMBDA_NAME);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.completed).toBeDefined();
            expect(results.completed.length).toEqual(1);
            expect(results.failed).toBeDefined();
            expect(results.failed.length).toEqual(1);
        });

        test('should return success all test batches succeed', async () => {
            const results = await testBatchService.delegateExecutions([
                events.testBatchService.testBatchValid,
                events.testBatchService.testBatchValid
            ], 'id', LAMBDA_NAME);
            expect(results).toBeDefined();
            expect(results.success).toEqual(true);
            expect(results.completed).toBeDefined();
            expect(results.completed.length).toEqual(2);
            expect(results.failed).toBeDefined();
            expect(results.failed.length).toEqual(0);
        });

        test('should return success given an empty or undefined set of test batches', async () => {
            const undefinedResults = await testBatchService.delegateExecutions(undefined, null, LAMBDA_NAME);
            expect(undefinedResults).toBeDefined();
            expect(undefinedResults.success).toEqual(true);
            expect(undefinedResults.completed).toBeDefined();
            expect(undefinedResults.completed.length).toEqual(0);
            expect(undefinedResults.failed).toBeDefined();
            expect(undefinedResults.failed.length).toEqual(0);

            const emptyResults = await testBatchService.delegateExecutions([], null, LAMBDA_NAME);
            expect(emptyResults).toBeDefined();
            expect(emptyResults.success).toEqual(true);
            expect(emptyResults.completed).toBeDefined();
            expect(emptyResults.completed.length).toEqual(0);
            expect(emptyResults.failed).toBeDefined();
            expect(emptyResults.failed.length).toEqual(0);
        });
    });

    describe('validateTestBatch()', () => {
        test('should return an error given an undefined test batch', () => {
            const errors = testBatchService.validateTestBatch(undefined);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(1);
            expect(errors[0]).toEqual('Batch:name-not-found|Test Batch is null or undefined.');
        });

        test('should return errors given a test batch missing required properties', () => {
            const errors = testBatchService.validateTestBatch(events.testBatchService.testBatchMissingThings);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(3);
        });

        test('should return no errors given a test batch missing optional properties', () => {
            const errors = testBatchService.validateTestBatch(events.testBatchService.testBatchValidNoSetupNoTeardown);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(0);
        });

        test('should return no errors given a valid test batch', () => {
            const errors = testBatchService.validateTestBatch(events.testBatchService.testBatchValid);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(0);
        });
    });
});
