// Services
let dynamoGetAction = require('../../lib/actions/dynamoGet');
let dynamoPutAction = require('../../lib/actions/dynamoPut');

// Data
let events = require('../events.json');
let responses = require('../responses');

const actionsService = require('../../lib/actionsService');
describe('actionsService', () => {

    afterEach(() => {
        jest.resetModules();
    });

    describe('performAction()', () => {
        beforeEach(() => {
            // Reload modules into node cache so that mocking works properly
            dynamoGetAction = require('../../lib/actions/dynamoGet');
            dynamoPutAction = require('../../lib/actions/dynamoPut');
            events = require('../events.json');
            responses = require('../responses');
        });

        test('should return an action with a failure result given an invalid action', async () => {
            const action = await actionsService.performAction();
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(false);
            expect(action.result.response).toBeUndefined();
            expect(action.result.error).toBeDefined();
            expect(action.result.error.message).toEqual('Failed to perform action. Action contains validation errors.');
            expect(action.result.error.data).toBeDefined();
            expect(action.result.error.data.length).toEqual(1);
            expect(action.result.failedAttempts).toBeUndefined();
        });

        test('should return an action with a success result', async () => {
            dynamoGetAction.execute = jest.fn(() => responses.functionalTestActions.genericSuccess);

            const action = await actionsService.performAction(events.actionsService.validDynamoGetAction);
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(true);
            expect(action.result.error).toBeUndefined();
            expect(action.result.response).toBeDefined();
            expect(action.result.response.status).toEqual('WINNER');
            expect(action.result.failedAttempts.length).toEqual(0);
        });

        test('should return an action with a success result given a valid action with an expected response', async () => {
            dynamoPutAction.execute = jest.fn(() => responses.functionalTestActions.genericSuccess);

            const action = await actionsService.performAction(events.actionsService.validActionWithExpectedResponse);
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(true);
            expect(action.result.error).toBeUndefined();
            expect(action.result.response).toBeDefined();
            expect(action.result.response.status).toEqual('WINNER');
            expect(action.result.failedAttempts.length).toEqual(0);
        });

        test('should return an action with a success result given a valid action with an expected comparison response', async () => {
            dynamoPutAction.execute = jest.fn(() => responses.functionalTestActions.complexSuccess);

            const action = await actionsService.performAction(events.actionsService.validActionWithExpectedCompareResponse);
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(true);
            expect(action.result.error).toBeUndefined();
            expect(action.result.response).toBeDefined();
            expect(action.result.response.status).toEqual('COMPLEX');
            expect(action.result.failedAttempts.length).toEqual(0);
        });

        test('should return an action with a success result given a valid action with a primitive expected response', async () => {
            dynamoPutAction.execute = jest.fn(() => responses.functionalTestActions.primitiveSuccess);

            const action = await actionsService.performAction(events.actionsService.validActionWithExpectedPrimitiveResponse);
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(true);
            expect(action.result.error).toBeUndefined();
            expect(action.result.response).toBeDefined();
            expect(action.result.response).toEqual('success');
            expect(action.result.failedAttempts.length).toEqual(0);
        });

        test('should return an action with a failure result given a valid action with a non-matching expected response', async () => {
            dynamoPutAction.execute = jest.fn(() => responses.functionalTestActions.genericSuccess);

            const action = await actionsService.performAction(events.actionsService.validActionWithExpectedPrimitiveResponse);
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(false);
            expect(action.result.error).toBeUndefined();
            expect(action.result.response).toBeDefined();
            expect(action.result.message).toEqual('Comparison with expected response failed.');
            expect(action.result.response.status).toEqual('WINNER');
            expect(action.result.failedAttempts.length).toEqual(0);
        });

        test('should return an action with a failure result given a valid action which throws an error', async () => {
            dynamoPutAction.execute = jest.fn(() => { throw responses.functionalTestActions.error; });

            const action = await actionsService.performAction(events.actionsService.validActionWithExpectedResponse);
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(false);
            expect(action.result.response).toBeUndefined();
            expect(action.result.error).toBeDefined();
            expect(action.result.error.message).toEqual('You dun goofed!');
            expect(action.result.error.data).toBeDefined();
            expect(action.result.failedAttempts.length).toEqual(0);
        });

        test('should return an action with a success result given a valid action which throws with a matching expected error', async () => {
            dynamoPutAction.execute = jest.fn(() => { throw responses.functionalTestActions.error; });

            const action = await actionsService.performAction(events.actionsService.validActionWithExpectedError);
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(true);
            expect(action.result.response).toBeUndefined();
            expect(action.result.error).toBeDefined();
            expect(action.result.error.message).toEqual('You dun goofed!');
            expect(action.result.error.data).toBeDefined();
            expect(action.result.failedAttempts.length).toEqual(0);
        });

        test('should return an action with a failure result given a valid action which throws with a non-matching expected error', async () => {
            dynamoPutAction.execute = jest.fn(() => { throw responses.functionalTestActions.error; });

            const action = await actionsService.performAction(events.actionsService.validActionWithExpectedPrimitiveError);
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(false);
            expect(action.result.response).toBeUndefined();
            expect(action.result.error).toBeDefined();
            expect(action.result.message).toEqual('Comparison with expected error failed.');
            expect(action.result.failedAttempts.length).toEqual(0);
        });

        test('should return an action with a failure result and retries given a valid action which throws an error and has retries configured', async () => {
            dynamoPutAction.execute = jest.fn(() => { throw responses.functionalTestActions.error; });

            const event = events.actionsService.validActionWithRetry;
            event.result = { attempts: [] };
            const action = await actionsService.performAction(event);
            expect(action).toBeDefined();
            expect(action.result).toBeDefined();
            expect(action.result.success).toEqual(false);
            expect(action.result.response).toBeUndefined();
            expect(action.result.error).toBeDefined();
            expect(action.result.error.message).toEqual('You dun goofed!');
            expect(action.result.error.data).toBeDefined();
            expect(action.result.failedAttempts.length).toEqual(1);

            const failed = action.result.failedAttempts[0];
            expect(failed.success).toEqual(false);
            expect(failed.response).toBeUndefined();
            expect(failed.error).toBeDefined();
            expect(failed.error.message).toEqual('You dun goofed!');
            expect(failed.error.data).toBeDefined();
        });
    });

    describe('performActions()', () => {
        beforeEach(() => {
            // Reload modules into node cache so that mocking works properly
            dynamoGetAction = require('../../lib/actions/dynamoGet');
            dynamoPutAction = require('../../lib/actions/dynamoPut');
        });

        test('should return a success result with no or undefined actions', async () => {
            const undefinedResults = await actionsService.performActions();

            expect(undefinedResults).toBeDefined();
            expect(undefinedResults.success).toEqual(true);
            expect(undefinedResults.completed).toBeDefined();
            expect(undefinedResults.completed.length).toEqual(0);
            expect(undefinedResults.failed).toBeDefined();
            expect(undefinedResults.failed.length).toEqual(0);

            const emptyResults = await actionsService.performActions([]);

            expect(emptyResults).toBeDefined();
            expect(emptyResults.success).toEqual(true);
            expect(emptyResults.completed).toBeDefined();
            expect(emptyResults.completed.length).toEqual(0);
            expect(emptyResults.failed).toBeDefined();
            expect(emptyResults.failed.length).toEqual(0);
        });

        test('should return a success result with all successful actions', async () => {
            dynamoGetAction.execute = jest.fn(() => responses.functionalTestActions.genericSuccess);
            dynamoPutAction.execute = jest.fn(() => responses.functionalTestActions.genericSuccess);

            const results = await actionsService.performActions([
                events.actionsService.validDynamoGetAction,
                events.actionsService.validDynamoPutAction
            ]);

            expect(results).toBeDefined();
            expect(results.success).toEqual(true);
            expect(results.completed).toBeDefined();
            expect(results.completed.length).toEqual(2);
            expect(results.failed).toBeDefined();
            expect(results.failed.length).toEqual(0);
        });

        test('should return a failed result with all some successful and some failed actions', async () => {
            dynamoGetAction.execute = jest.fn(() => responses.functionalTestActions.genericSuccess);
            dynamoPutAction.execute = jest.fn(() => { throw responses.functionalTestActions.error; });

            const results = await actionsService.performActions([
                events.actionsService.validDynamoGetAction,
                events.actionsService.validDynamoPutAction
            ]);

            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.completed).toBeDefined();
            expect(results.completed.length).toEqual(1);
            expect(results.failed).toBeDefined();
            expect(results.failed.length).toEqual(1);
        });

        test('should return a failed result with all failed actions', async () => {
            dynamoGetAction.execute = jest.fn(() => { throw responses.functionalTestActions.error; });
            dynamoPutAction.execute = jest.fn(() => { throw responses.functionalTestActions.error; });

            const results = await actionsService.performActions([
                events.actionsService.validDynamoGetAction,
                events.actionsService.validDynamoPutAction
            ]);

            expect(results).toBeDefined();
            expect(results.success).toEqual(false);
            expect(results.completed).toBeDefined();
            expect(results.completed.length).toEqual(0);
            expect(results.failed).toBeDefined();
            expect(results.failed.length).toEqual(2);
        });
    });

    describe('validateAction()', () => {
        test('should return an error given no action', () => {
            const errors = actionsService.validateAction();
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(1);
        });

        test('should return an error given an action with a missing type', () => {
            const errors = actionsService.validateAction(events.actionsService.invalidActionMissingType);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(1);
        });

        test('should return errors given an action with a bad type and bad expectations', () => {
            const errors = actionsService.validateAction(events.actionsService.invalidActionExpectationAndType);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(6);
        });

        test('should return errors given an action with bad retry configurations', () => {
            const errors = actionsService.validateAction(events.actionsService.invalidActionBadRetry);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(3);
        });

        test('should return errors given an action with negative retry configurations', () => {
            const errors = actionsService.validateAction(events.actionsService.invalidActionNegativeRetry);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(3);
        });

        test('should return no errors given a valid action', () => {
            const errors = actionsService.validateAction(events.actionsService.validAction);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(0);
        });

        test('should return no errors given a valid action with expected response', () => {
            const errors = actionsService.validateAction(events.actionsService.validActionWithExpectedResponse);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(0);
        });

        test('should return no errors given a valid action with expected error', () => {
            const errors = actionsService.validateAction(events.actionsService.validActionWithExpectedError);
            expect(errors).toBeDefined();
            expect(errors.length).toEqual(0);
        });
    });
});
