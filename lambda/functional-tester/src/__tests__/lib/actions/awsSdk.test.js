// Data
const events = require('../../events.json');

// Libraries
const AWSSDK = require('aws-sdk');
const AWS = require('aws-sdk-mock');

const awsSdkAction = require('../../../lib/actions/awsSdk');
describe('awsSdkAction', () => {

    beforeEach(() => {
        jest.resetModules();
        AWS.setSDKInstance(AWSSDK);

        AWS.mock('S3', 'copyObject', function (params, callback) {
            callback(null, 'successfully copied item in bucket');
        });
    });

    afterEach(() => {
        AWS.restore('S3', 'copyObject');
    });

    test('should throw given missing parameters', async () => {
        try {
            await awsSdkAction.execute(events.awsSdk.invalidParams);
            throw new Error('Test should have thrown, but did not.');
        } catch (err) {
            expect(err.message).toEqual('Action config validation failed.');
            expect(err.data.length).toEqual(2);
        }
    });

    test('should throw given an invalid AWS service', async () => {
        try {
            await awsSdkAction.execute(events.awsSdk.invalidService);
            throw new Error('Test should have thrown, but did not.');
        } catch (err) {
            expect(err.message).toEqual('Failed to instantiate AWS SDK Service \'chicken\'.');
        }
    });

    test('should throw given the AWS service call fails', async () => {
        try {
            AWS.restore('S3', 'copyObject');
            AWS.mock('S3', 'copyObject', function (params, callback) {
                callback('copyObject failed');
            });

            await awsSdkAction.execute(events.awsSdk.valid);
            throw new Error('Test should have thrown, but did not.');
        } catch (err) {
            expect(err).toEqual('copyObject failed');
        }
    });

    test('should succeed', async () => {
        const result = await awsSdkAction.execute(events.awsSdk.valid);
        expect(result).toEqual('successfully copied item in bucket')
    });
});
