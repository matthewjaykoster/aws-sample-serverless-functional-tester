// Data
const events = require('../../events.json');

// Libraries
const AWSSDK = require('aws-sdk');
const AWS = require('aws-sdk-mock');

const kinesisPutRecordAction = require('../../../lib/actions/kinesisPutRecord');
describe('kinesisPutRecordAction', () => {
    
    beforeEach(() => {
        jest.resetModules();
        AWS.setSDKInstance(AWSSDK);

        AWS.mock('Kinesis', 'putRecord', function (params, callback) {
            callback(null, 'successfully put record');
        });
    });

    afterEach(() => {
        AWS.restore('Kinesis', 'putRecord');
    });

    test('should throw given the AWS service call fails', async () => {
        try {
            AWS.restore('Kinesis', 'putRecord');
            AWS.mock('Kinesis', 'putRecord', function (params, callback) {
                callback('put failed');
            });

            await kinesisPutRecordAction.execute(events.kinesisPutRecord.valid);
            throw new Error('Test should have thrown, but did not.');
        } catch (err) {
            expect(err).toEqual('put failed');
        }
    });

    test('should succeed', async () => {
        const result = await kinesisPutRecordAction.execute(events.kinesisPutRecord.valid);
        expect(result).toEqual('successfully put record')
    });
});
