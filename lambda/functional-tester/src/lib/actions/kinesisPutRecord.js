/**
 * Description: Handles the action 'kinesisPutRecord'. Puts a record into a kinesis stream.
 * Parameters:
 * - See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html#putRecord-property
 */

// Libraries
const AWS = require('aws-sdk');
const log = require('lambda-log');

/**
 * Put a record into a kinesis stream.
 * @param {Object} params Parameters required to execute this action.
 * @returns {Object} Whatever the AWS SDK would return
 */
async function execute(params) {
    log.debug(`Putting record to stream '${params.StreamName}'.`);
    const kinesis = new AWS.Kinesis();
    return await kinesis.putRecord(params).promise();
}

module.exports.execute = execute;