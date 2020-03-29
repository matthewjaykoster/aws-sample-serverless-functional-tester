// Data
const events = require('../../events.json');

// Libraries
const AWSSDK = require('aws-sdk');
const AWS = require('aws-sdk-mock');

const dynamoDeleteAction = require('../../../lib/actions/dynamoDelete');
describe('dynamoDeleteAction', () => {
    
    beforeEach(() => {
        jest.resetModules();
        AWS.setSDKInstance(AWSSDK);

        AWS.mock('DynamoDB.DocumentClient', 'delete', function (params, callback) {
            callback(null, 'successfully deleted object');
        });
    });

    afterEach(() => {
        AWS.restore('DynamoDB.DocumentClient', 'delete');
    });

    test('should throw given the AWS service call fails', async () => {
        try {
            AWS.restore('DynamoDB.DocumentClient', 'delete');
            AWS.mock('DynamoDB.DocumentClient', 'delete', function (params, callback) {
                callback('delete failed');
            });

            await dynamoDeleteAction.execute(events.dynamoDelete.valid);
            throw new Error('Test should have thrown, but did not.');
        } catch (err) {
            expect(err).toEqual('delete failed');
        }
    });

    test('should succeed', async () => {
        const result = await dynamoDeleteAction.execute(events.dynamoDelete.valid);
        expect(result).toEqual('successfully deleted object')
    });
});
