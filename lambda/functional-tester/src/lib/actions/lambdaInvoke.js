/**
 * Description: Handles the action 'lambdaInvoke'. Invokes a lambda.
 * Parameters:
 * - See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#invoke-property
 */

// Libraries
const AWS = require('aws-sdk');
const log = require('lambda-log');

/**
 * Invokes a lambda.
 * @param {Object} params Parameters required to execute this action.
 * @returns {Object} Whatever the AWS SDK would return
 */
async function execute(params) {
    log.debug(`Invoking Lambda '${params.FunctionName}'.`);
    const lambda = new AWS.Lambda();
    return await lambda.invoke(params).promise();
}

module.exports.execute = execute;