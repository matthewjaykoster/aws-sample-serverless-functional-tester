/**
 * Description: Handles the action 'awsSdk'. Calls an arbitrary AWS service via the JS SDK.
 * Parameters:
 * - *serviceName: Name of AWS service (e.g. "S3", "DynamoDB.DocumentClient")
 * - serviceParams: Parameters to pass to the constructor of the AWS service
 * - *method: Service method to call
 * - methodParams: Parameters to pass to the service method
 */

// Classes
const DataError = require('../DataError');

// Libraries
const AWS = require('aws-sdk');
const log = require('lambda-log');

/**
 * Get an instantiated AWS SDK service from the name
 * @param {String} name Service to instantiate
 * @param {Object} params Params with which to instantiate the service
 */
function _getAwsService(name, params) {
    let root = AWS;

    const segments = name.split('.');
    while (segments.length > 0) {
        root = root[segments.shift()];
    }
    
    try {
        return new root(params);
    } catch (err) {
        throw new Error(`Failed to instantiate AWS SDK Service '${name}'.`);
    }
}

/**
 * Validate the parameters object.
 * @param {Object} params Action configuration
 */
function _validateParameters(params) {
    const errors = [];

    if (!params.serviceName) errors.push('Missing required parameter: serviceName');
    if (!params.method) errors.push('Missing required parameter: method');

    return errors;
}

/**
 * Call an arbitrary AWS service/action via the JS SDK.
 * @param {Object} params Parameters required to execute this action.
 * @returns {Object} Whatever the AWS SDK would return
 */
async function execute(params) {
    // Validate the parameters
    const validationErrors = _validateParameters(params);
    if (validationErrors.length) {
        throw new DataError('Action config validation failed.', validationErrors);
    }

    // Get the service
    log.debug(`Calling ${params.serviceName}.${params.method}().`);
    const service = _getAwsService(params.serviceName, params.serviceParams);

    // Run the command
    return await service[params.method](params.methodParams).promise();
}

module.exports.execute = execute;