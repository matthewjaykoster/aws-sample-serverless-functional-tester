/**
 * Description: Handles the action 'dynamoPut'. Puts a record into a dynamo table.
 * Parameters:
 * - See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#put-property
 */

// Libraries
const AWS = require('aws-sdk');
const log = require('lambda-log');

/**
 * Put a record into a dynamo table.
 * @param {Object} params Parameters required to execute this action.
 * @returns {Object} Whatever the AWS SDK would return
 */
async function execute(params) {
    log.debug(`Putting record into table '${params.TableName}'.`);
    const dynamo = new AWS.DynamoDB.DocumentClient();
    return await dynamo.put(params).promise();
}

module.exports.execute = execute;