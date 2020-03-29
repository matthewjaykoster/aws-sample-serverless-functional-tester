// Data
const events = require('../../events.json');

// Libraries
const AWSSDK = require('aws-sdk');
const AWS = require('aws-sdk-mock');

const dynamoPutAction = require('../../../lib/actions/dynamoPut');
describe('dynamoPutAction', () => {
    
    beforeEach(() => {
        jest.resetModules();
        AWS.setSDKInstance(AWSSDK);

        AWS.mock('DynamoDB.DocumentClient', 'put', function (params, callback) {
            callback(null, 'successfully put object');
        });
    });

    afterEach(() => {
        AWS.restore('DynamoDB.DocumentClient', 'put');
    });

    test('should throw given the AWS service call fails', async () => {
        try {
            AWS.restore('DynamoDB.DocumentClient', 'put');
            AWS.mock('DynamoDB.DocumentClient', 'put', function (params, callback) {
                callback('put failed');
            });

            await dynamoPutAction.execute(events.dynamoPut.valid);
            throw new Error('Test should have thrown, but did not.');
        } catch (err) {
            expect(err).toEqual('put failed');
        }
    });

    test('should succeed', async () => {
        const result = await dynamoPutAction.execute(events.dynamoPut.valid);
        expect(result).toEqual('successfully put object')
    });
});
