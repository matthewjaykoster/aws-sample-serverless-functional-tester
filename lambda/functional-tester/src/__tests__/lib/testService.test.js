// Services
let actionsService = require('../../lib/actionsService');

// Data
const events = require('../events.json');
const responses = require('../responses');

let testService = require('../../lib/testService');
describe('testService', () => {

    beforeEach(() => {
        // Reload modules into node cache so that mocking works properly
        testService = require('../../lib/testService');
        actionsService = require('../../lib/actionsService');
        actionsService.validateAction = jest.fn(() => responses.actionsService.noValidationErrors);
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('runTest()', () => {
        test('should return success given setup, test, and teardown actions succeed', async () => {
            actionsService.performActions = jest.fn(() => responses.actionsService.actionsSuccess);

            const results = await testService.runTest(events.testService.testValid);
            expect(results).toBeDefined();
            expect(results.success).toEqual(true);
            expect(results.message).toEqual('Test complete.');
            expect(results.setup).toBeDefined();
            expect(results.testActions).toBeDefined();
            expect(results.teardown).toBeDefined();
        });

        test('should return failure given the test has validation errors', async () => {
            actionsService.performActions = jest.fn(() => responses.actionsService.actionsSuccess);

            const results = await testService.runTest(events.testService.testMissingThings);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Failed to run test. Test contains validation errors.');
            expect(results.error).toBeDefined();
            expect(results.setup).toBeNull();
            expect(results.testActions).toBeNull();
            expect(results.teardown).toBeNull();
        });

        test('should return failure given setup actions fail, and should skip test actions', async () => {
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsFailed)
                .mockReturnValueOnce(responses.actionsService.actionsSuccess);

            const results = await testService.runTest(events.testService.testValid);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Setup failed');
            expect(results.setup).toBeDefined();
            expect(results.testActions).toBeNull();
            expect(results.teardown).toBeDefined();
        });

        test('should return failure given test actions fail', async () => {
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsSuccess)
                .mockReturnValueOnce(responses.actionsService.actionsFailed)
                .mockReturnValueOnce(responses.actionsService.actionsSuccess);

            const results = await testService.runTest(events.testService.testValid);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Test actions failed');
            expect(results.setup).toBeDefined();
            expect(results.testActions).toBeDefined();
            expect(results.teardown).toBeDefined();
        });

        test('should return failure given teardown actions fail', async () => {
            actionsService.performActions = jest.fn()
                .mockReturnValueOnce(responses.actionsService.actionsSuccess)
                .mockReturnValueOnce(responses.actionsService.actionsSuccess)
                .mockReturnValueOnce(responses.actionsService.actionsFailed);

            const results = await testService.runTest(events.testService.testValid);
            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.message).toEqual('Teardown failed');
            expect(results.setup).toBeDefined();
            expect(results.testActions).toBeDefined();
            expect(results.teardown).toBeDefined();
        });
    });

    describe('runTests()', () => {
        test('should return a success result with no tests', async () => {
            const undefinedTestsRunResults = await testService.runTests();
            expect(undefinedTestsRunResults).toBeDefined();
            expect(undefinedTestsRunResults.success).toEqual(true);
            expect(undefinedTestsRunResults.completed).toBeDefined();
            expect(undefinedTestsRunResults.completed.length).toEqual(0);
            expect(undefinedTestsRunResults.failed).toBeDefined();
            expect(undefinedTestsRunResults.failed.length).toEqual(0);

            const emptytestsRunResults = await testService.runTests([]);
            expect(emptytestsRunResults).toBeDefined();
            expect(emptytestsRunResults.success).toEqual(true);
            expect(emptytestsRunResults.completed).toBeDefined();
            expect(emptytestsRunResults.completed.length).toEqual(0);
            expect(emptytestsRunResults.failed).toBeDefined();
            expect(emptytestsRunResults.failed.length).toEqual(0);
        });

        test('should return a success result with all successful tests', async () => {
            actionsService.performActions = jest.fn(() => responses.actionsService.actionsSuccess);

            const testsRunResults = await testService.runTests([
                events.testService.testValid,
                events.testService.testValid
            ]);
            expect(testsRunResults).toBeDefined();
            expect(testsRunResults.success).toEqual(true);
            expect(testsRunResults.completed).toBeDefined();
            expect(testsRunResults.completed.length).toEqual(2);
            expect(testsRunResults.failed).toBeDefined();
            expect(testsRunResults.failed.length).toEqual(0);
        });

        test('should return a failure result with all failed tests', async () => {
            actionsService.performActions = jest.fn(() => responses.actionsService.actionsFailed);

            const testsRunResults = await testService.runTests([
                events.testService.testValid,
                events.testService.testValid
            ]);
            expect(testsRunResults).toBeDefined();
            expect(testsRunResults.success).toEqual(false);
            expect(testsRunResults.completed).toBeDefined();
            expect(testsRunResults.completed.length).toEqual(0);
            expect(testsRunResults.failed).toBeDefined();
            expect(testsRunResults.failed.length).toEqual(2);
        });
    });

    describe('validateTest()', () => {
        test('should return a scoped error given an undefined test with a parent scope', () => {
            const errors = testService.validateTest(undefined, 'Batch:FunctionalTest');
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(1);
            expect(errors[0]).toEqual('Batch:FunctionalTest|Test:name-not-found|Test is null or undefined.');
        });

        test('should return errors given a test missing required properties', () => {
            const errors = testService.validateTest(events.testService.testMissingThings);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(3);
        });

        test('should return no errors given a test missing optional properties', () => {
            const errors = testService.validateTest(events.testService.testValidNoSetupNoTeardown);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(0);
        });

        test('should return no errors given a valid test', () => {
            const errors = testService.validateTest(events.testService.testValid);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(0);
        });
    });
});
