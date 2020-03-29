/**
 * Description: Handles the action 'dynamoDelete'. Deletes a record from a dynamo table.
 * Parameters:
 * - https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#delete-property
 */

// Libraries
const AWS = require('aws-sdk');
const log = require('lambda-log');

/**
 * Delete a record from a dynamo table.
 * @param {Object} params Parameters required to execute this action.
 * @returns {Object} Whatever the AWS SDK would return
 */
async function execute(params) {
    log.debug(`Deleting record from table '${params.TableName}'.`);
    const dynamo = new AWS.DynamoDB.DocumentClient();
    return await dynamo.delete(params).promise();
}

module.exports.execute = execute;