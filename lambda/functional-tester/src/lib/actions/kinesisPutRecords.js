/**
 * Description: Handles the action 'kinesisPutRecords'. Puts records into a kinesis stream.
 * Parameters:
 * - See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html#putRecords-property
 */

// Libraries
const AWS = require('aws-sdk');
const log = require('lambda-log');

/**
 * Puts records into a kinesis stream.
 * @param {Object} params Parameters required to execute this action.
 * @returns {Object} Whatever the AWS SDK would return
 */
async function execute(params) {
    log.debug(`Putting records to stream '${params.StreamName}'.`);
    const kinesis = new AWS.Kinesis();
    return await kinesis.putRecords(params).promise();
}

module.exports.execute = execute;