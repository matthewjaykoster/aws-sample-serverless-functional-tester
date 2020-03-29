// Data
const events = require('../../events.json');

// Libraries
const AWSSDK = require('aws-sdk');
const AWS = require('aws-sdk-mock');

const lambdaInvokeAction = require('../../../lib/actions/lambdaInvoke');
describe('lambdaInvokeAction', () => {
    
    beforeEach(() => {
        jest.resetModules();
        AWS.setSDKInstance(AWSSDK);

        AWS.mock('Lambda', 'invoke', function (params, callback) {
            callback(null, 'successfully invoked function');
        });
    });

    afterEach(() => {
        AWS.restore('Lambda', 'invoke');
    });

    test('should throw given the AWS service call fails', async () => {
        try {
            AWS.restore('Lambda', 'invoke');
            AWS.mock('Lambda', 'invoke', function (params, callback) {
                callback('invoke failed');
            });

            await lambdaInvokeAction.execute(events.lambdaInvoke.valid);
            throw new Error('Test should have thrown, but did not.');
        } catch (err) {
            expect(err).toEqual('invoke failed');
        }
    });

    test('should succeed', async () => {
        const result = await lambdaInvokeAction.execute(events.lambdaInvoke.valid);
        expect(result).toEqual('successfully invoked function')
    });
});
