// Data
const events = require('../../events.json');

// Libraries
const AWSSDK = require('aws-sdk');
const AWS = require('aws-sdk-mock');

const dynamoGetAction = require('../../../lib/actions/dynamoGet');
describe('dynamoGetAction', () => {
    
    beforeEach(() => {
        jest.resetModules();
        AWS.setSDKInstance(AWSSDK);

        AWS.mock('DynamoDB.DocumentClient', 'get', function (params, callback) {
            callback(null, 'successfully got object');
        });
    });

    afterEach(() => {
        AWS.restore('DynamoDB.DocumentClient', 'get');
    });

    test('should throw given the AWS service call fails', async () => {
        try {
            AWS.restore('DynamoDB.DocumentClient', 'get');
            AWS.mock('DynamoDB.DocumentClient', 'get', function (params, callback) {
                callback('get failed');
            });

            await dynamoGetAction.execute(events.dynamoGet.valid);
            throw new Error('Test should have thrown, but did not.');
        } catch (err) {
            expect(err).toEqual('get failed');
        }
    });

    test('should succeed', async () => {
        const result = await dynamoGetAction.execute(events.dynamoGet.valid);
        expect(result).toEqual('successfully got object')
    });
});
