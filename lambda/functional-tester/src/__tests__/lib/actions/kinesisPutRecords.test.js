// Data
const events = require('../../events.json');

// Libraries
const AWSSDK = require('aws-sdk');
const AWS = require('aws-sdk-mock');

const kinesisPutRecordsAction = require('../../../lib/actions/kinesisPutRecords');
describe('kinesisPutRecordsAction', () => {
    
    beforeEach(() => {
        jest.resetModules();
        AWS.setSDKInstance(AWSSDK);

        AWS.mock('Kinesis', 'putRecords', function (params, callback) {
            callback(null, 'successfully put records');
        });
    });

    afterEach(() => {
        AWS.restore('Kinesis', 'putRecords');
    });

    test('should throw given the AWS service call fails', async () => {
        try {
            AWS.restore('Kinesis', 'putRecords');
            AWS.mock('Kinesis', 'putRecords', function (params, callback) {
                callback('puts failed');
            });

            await kinesisPutRecordsAction.execute(events.kinesisPutRecords.valid);
            throw new Error('Test should have thrown, but did not.');
        } catch (err) {
            expect(err).toEqual('puts failed');
        }
    });

    test('should succeed', async () => {
        const result = await kinesisPutRecordsAction.execute(events.kinesisPutRecords.valid);
        expect(result).toEqual('successfully put records')
    });
});
