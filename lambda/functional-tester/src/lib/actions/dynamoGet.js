/**
 * Description: Handles the action 'dynamoGet'. Gets a record from a dynamo table.
 * Parameters:
 * - See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#get-property
 */

// Libraries
const AWS = require('aws-sdk');
const log = require('lambda-log');

/**
 * Get a record from a dynamo table.
 * @param {Object} params Parameters required to execute this action.
 * @returns {Object} Whatever the AWS SDK would return
 */
async function execute(params) {
    log.debug(`Getting record from table '${params.TableName}'.`);
    const dynamo = new AWS.DynamoDB.DocumentClient();
    return await dynamo.get(params).promise();
}

module.exports.execute = execute;