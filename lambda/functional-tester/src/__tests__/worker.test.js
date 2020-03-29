// Constants
const mockContext = {
    account: '983054836469',
    alias: 'test',
    invokedFunctionArn: 'aws:arn:lambda:us-east-1:983054836469'
};

// Data
const events = require('./events.json');
const responses = require('./responses');

// Services
let actionsService = require('../lib/actionsService');
let testBatchService = require('../lib/testBatchService');
let testService = require('../lib/testService');

let worker = require('../worker.js');
describe('functional-tester-worker', () => {

    beforeEach(() => {        
        // Reload modules so I can actually mock them because node's global space caching makes tests ANNOYING AS @#%&
        actionsService = require('../lib/actionsService');
        actionsService.performActions = jest.fn(() => responses.actionsService.actionsSuccess);

        testService = require('../lib/testService');
        testService.runTests = jest.fn(() => responses.testService.testsSuccess);

        testBatchService = require('../lib/testBatchService');
        testBatchService.validateTestBatch = jest.fn(() => []);

        worker = require('../worker.js');
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('handler()', () => {
        test('should return a failed error result given an undefined test batch', async () => {
            const results = await worker.handler(undefined, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.error).toBeDefined();
            expect(results.error.message).toEqual('Test Batch is undefined or empty.');
            expect(results.message).toEqual('Test Batch Failure: Caught global error.');
        });

        test('should return a failed error result given a configuration error', async () => {
            testBatchService.validateTestBatch = jest.fn(() => responses.testBatchService.validationErrors);

            const results = await worker.handler(events.worker.testBatchMissingThings, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.error).toBeDefined();
            expect(results.error.message).toEqual('Test configuration contains 1 validation error(s).');
            expect(results.message).toEqual('Test Batch Failed: Configuration is invalid.');
            expect(results.validationErrors).toBeDefined();
            expect(results.validationErrors.length).toEqual(1);
        });

        test('should return a failed result given setup actions fail and not run tests', async () => {
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsFailed)
                .mockReturnValueOnce(responses.actionsService.actionsSuccess);

            const results = await worker.handler(events.worker.testBatchValid, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.error).toBeUndefined();
            expect(results.message).toEqual('Setup failed.');
            expect(results.validationErrors).toBeUndefined();
            expect(results.setup).toBeDefined();
            expect(results.setup.success).toEqual(false);
            expect(results.tests).toBeUndefined();
            expect(results.teardown).toBeDefined();
            expect(results.teardown.success).toEqual(true);
        });

        test('should return a failed result given at least one test fails', async () => {
            testService.runTests = jest.fn(() => responses.testService.testsFailed);
            
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsSuccess)
                .mockReturnValueOnce(responses.actionsService.actionsSuccess);

            const results = await worker.handler(events.worker.testBatchValid, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.error).toBeUndefined();
            expect(results.message).toEqual('Test(s) failed.');
            expect(results.validationErrors).toBeUndefined();
            expect(results.setup).toBeDefined();
            expect(results.setup.success).toEqual(true);
            expect(results.tests).toBeDefined();
            expect(results.tests.success).toEqual(false);
            expect(results.teardown).toBeDefined();
            expect(results.teardown.success).toEqual(true);
        });

        test('should return a failed result given teardown actions fail', async () => {
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsSuccess)
                .mockReturnValueOnce(responses.actionsService.actionsFailed);

            const results = await worker.handler(events.worker.testBatchValid, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.error).toBeUndefined();
            expect(results.message).toEqual('Teardown failed.');
            expect(results.validationErrors).toBeUndefined();
            expect(results.setup).toBeDefined();
            expect(results.setup.success).toEqual(true);
            expect(results.tests).toBeDefined();
            expect(results.tests.success).toEqual(true);
            expect(results.teardown).toBeDefined();
            expect(results.teardown.success).toEqual(false);
        });

        test('should return a failed error result given any service throws an error', async () => {
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsSuccess)
                .mockRejectedValueOnce({ message: 'this-is-an-error' });

            const results = await worker.handler(events.worker.testBatchValid, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.error).toBeDefined();
            expect(results.error.message).toEqual('this-is-an-error');
            expect(results.message).toEqual('Test Batch Failure: Caught global error.');
        });

        test('should return a success result given a valid test batch and successful execution', async () => {
            const results = await worker.handler(events.worker.testBatchValid, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(true);
            expect(results.message).toEqual('Test Success');
        });

        test('should return a success result given a valid test batch with no setup/teardown and successful execution', async () => {
            const results = await worker.handler(events.worker.testBatchValidNoSetupNoTeardown, mockContext);
            expect(results).toBeDefined();
            expect(results.success).toEqual(true);
            expect(results.message).toEqual('Test Success');
        });
    });
});
