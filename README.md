# aws-sample-serverless-functional-tester
Sample code for a simple serverless AWS-based Functional Tester. This code is intended as a starting point, and is not intended for use as a plug-and-play download. This readme assumes that you have an existing AWS account.

The Functional Tester consists of two separate lambdas, an Orchestrator and a Worker. The Orchestrator is responsible for pulling test configuration, executing global setup/teardown, and invoking one instance of the worker lambda per configured test batch. Each Worker is responsible for executing a single test batch, consisting of setup/teardown and a series of tests, which may contain their own setup/teardown, and must contain a set of actions and expected results/errors.

All tests use live features and AWS infrastructure, and do not contain any mocked functionality. Thus, these tests use live workflows, features, and processes contained within the platform, and incur any costs related to such events.

# Getting Started
1. Clone the repository.
2. Run npm install in ~/lambda/functional-tester.
3. Create a bucket which will hold your functional tester configuration and results. Note the name of this S3 bucket.
4. Copy the contents of ~/configuration into a folder of the same name in the S3 bucket you created to hold your functional tester configuration and results.
5. Zip the contents of ~/lambda/functional-tester and deploy it to S3. Note the S3 deployment location.
6. Update lambda definitions and IAM roles from ~/infrastructure/functional-tester/template.json to include references to the S3 locations you deployed the Orchestrator lambda code and Worker lambda code, and references to the bucket you created to hold your functional tester configuration and results.

# Config Files
The Functional Tester Configuration defines the setup, teardown, and test batches which the functional tester will run. Configuration is stored in and loaded from S3, split across all JSON files located using the Key Prefix configuration/ and containing the string "functional-test".

## Sample Configuation File
A sample configuration which puts a record into dynamo, runs a test to see if the expected item exists in dynamo, runs a test to see if invalid parameters give an error, and then remove the item from dynamo.

```
{
  "setupActions": [{
    "type": "dynamoPut",
    "params": {
      "TableName": "test_Table",
      "Item": { "key": "this-is-a-key", "property": "chicken" }
    }
  }],
  "testBatches": [{
    "name": "sample-test-batch",
    "description": "A test batch meant to show the structure of the test configuration file(s).",
    "setupActions": [],
    "tests": [{
      "name": "sample-test-1",
      "description": "Tests whether setup worked.",
      "setupActions": [],
      "testActions": [{
        "type": "dynamoGet",
        "params": {
          "TableName": "test_Table",
          "Key": { "key": "this-is-a-key" }
        },
        "expectedResponse": {
          "comparisonType": "equals",
          "response": {
            "Item": {
              "key": "this-is-a-key",
              "property": "chicken"
            }
          } 
        }
      },{
        "type": "dynamoGet",
        "params": {
          "TableName": "test_Table",
          "Key": { "key": "this-is-a-key-that-does-not-exist" }
        },
        "expectedError": {
          "comparisonType": "conatins-same-values",
          "error": {
            "message": "this-is-an-error"
          }
        }
      }],
      "teardownActions": []
    }],
    "teardownActions": []
  }],
  "teardownActions": [{
    "type": "dynamoDelete",
    "params": {
      "TableName": "test_Table",
      "Key": { "key": "this-is-a-key" }
    }
  }]
}
```

## Top-Level Properties
Top-level configuration properties contain all configuration information required to run the functional tester.

*setupActions*: List of global setup actions, performed before all test batches are delegated to the functional test worker.	
*testBatches*: List of test batches, delegated by the functional-test-orchestrator lambda to the functional-test-worker lambda.
*teardownActions*: List of global setup actions, performed after all test batches are delegated to the functional test worker.

## Test Batches
Test batches are lists of configuration for a specific set of tests, including a name, description, set of setup/teardown actions, and set of tests.

*name*: Test Batch name. Used to identify the test batch in the logs and in the results.
*description*: Test Batch description. Should contain the test batch's purpose and high-level summary.
*setupActions*: List of global setup actions, performed before all test batches are delegated to the functional test worker.
*tests*: List of test batches, delegated by the functional-test-orchestrator lambda to the functional-test-worker lambda.
*teardownActions*: List of global setup actions, performed after all test batches are delegated to the functional test worker.

### Sample Test Batches
```
{
  "name": "sample-test-batch",
  "description": "A test batch meant to show the structure of the test configuration file(s).",
  "setupActions": [],
  "tests": [{
    "name": "sample-test-1",
    "description": "Tests whether setup worked.",
    "setupActions": [],
    "testActions": [
      {
        "type": "dynamoGet",
        "params": {
          "TableName": "test_Table",
          "Key": { "key": "this-is-a-key" }
        },
        "expectedResponse": {
          "comparisonType": "equals",
          "response": {
            "Item": {
              "key": "this-is-a-key",
              "property": "chicken"
            }
          }
        }
      }
    ],
    "teardownActions": []
  }]
}
```

## Tests
Tests are lists of actions and expectations which allow us to validate that specific functionality is working.

*name*: Test name. Used to identify the test in the logs and in the results.
*description*: Test description. Should contain the test's purpose and high-level summary.
*setupActions*: List of global setup actions, performed before all test batches are delegated to the functional test worker.
*testActions*: List of test batches, delegated by the functional-test-orchestrator lambda to the functional-test-worker lambda.
*teardownActions*: List of global setup actions, performed after all test batches are delegated to the functional test worker.

### Sample Test
```

{
  "name": "sample-test-1",
  "description": "Tests whether setup worked.",
  "setupActions": [],
  "testActions": [
    {
      "type": "dynamoGet",
      "params": {
        "TableName": "test_Table",
        "Key": { "key": "this-is-a-key" }
      },
      "expectedResponse": {
        "comparisonType": "equals",
        "response": {
          "Item": {
            "key": "this-is-a-key",
            "property": "chicken"
          }
        }
      }
    }
  ],
  "teardownActions": []
}
```

## Actions
*expectedResponse*:	Object configuring expected success response from the action executor. Compared against the action executor's actual response to determine test success/failure. Comparison behavior is determined by property comparisonType(1).
*expectedError*: Object configuring expected error response from the action executor. Compared against the action executor's actual error to determine test success/failure. Comparison behavior is determined by property comparisonType(1).
*initialWaitMs*: Amount of time (in milliseconds) to wait before beginning the action.
*maxNumRetries*: The maximum number of retries allowed when the action fails. Thus, the total number of action attempts will be this number plus one.
*params*:	Parameters object which will be passed to the action executor. Required properties vary from action type to action type. See Action Type for specific samples.
*type*: Functional tester-supported Action Type. Defines the type of action taken.
*waitBetweenRetriesMs*: Amount of time (in milliseconds) to wait before retrying the action.

(1) Valid values for comparisonType: *equals*, *contains-same-values*. *equals* performs deep-comparison to check for object equality. *contains-same-values* checks that all values contained within the expected object exist and have the same value as the actual response/error.

### Sample Expected Response
Will check that the response exactly equals the object.

```
{
  "comparisonType": "equals",
  "response": {
    "Item": {
      "key": "this-is-a-key",
      "property": "chicken"
    }
  }
}
```

### Sample Expected Error
Will check that the response error to ensure it contains both "name" and "message" at the top-level, and that their values match.

```
{
  "comparisonType": "conatins-same-values",
  "error": {
    "name": "ValidationError",
    "message": "Validation failed"
  }
}
```

## Action Types
Below is a list of all valid action types. Any action type not in this list will cause a configuration validation error.

*awsSdk*: Executes an arbitrary AWS SDK service method. Note: This could fail if the orchestrator or worker does not have proper IAM permissions to perform the requested service method. Depending on your service call, see the AWS SDK Documentation. Parameters should match the SDK parameters.
*dynamoDelete*: Deletes a single item from Dynamo. Accepts AWS SDK parameters.
*dynamoGet*: Gets a single item from Dynamo. Accepts AWS SDK parameters.
*dynamoPut*: Puts a single item into Dynamo. Accepts AWS SDK parameters.
*kinesisPutRecord*:	Puts a single record into Kinesis. Accepts AWS SDK parameters.
*kinesisPutRecords*: Puts a list of records into Kinesis. Accepts AWS SDK parameters.
*lambdaInvoke*: Invokes a lambda synchronously and awaits the result. Accepts AWS SDK parameters.

# ToDos
- Include S3 buckets in CFN templates
- Parallelize Test Batch executions