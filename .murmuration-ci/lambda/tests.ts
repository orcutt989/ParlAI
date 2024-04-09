import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as assert from "assert";

// Import the Lambda function
import { lambdaFunction } from "./lambda";

/**
 * Unit Tests
 */

describe("Unit Tests for Lambda Function", () => {
    it("should have a valid function name", async () => {
        assert.strictEqual(lambdaFunction.functionName, "my-lambda-function");
    });

    it("should have Node.js 14 runtime", async () => {
        const lambda = await aws.lambda.getFunction({ functionName: "my-lambda-function" });
        assert.strictEqual(lambda.runtime, "nodejs14.x");
    });
});


/**
 * Integration Tests
 */
describe("Integration Tests for Lambda Function", () => {
  it("should return 'Hello, World!' on invocation", async () => {
      const lambda = new aws.lambda.Function("testLambda", {
          code: new pulumi.asset.AssetArchive({
              ".": new pulumi.asset.StringAsset(`exports.handler = async (event) => ({ statusCode: 200, body: 'Hello, World!' });`),
          }),
          runtime: aws.lambda.NodeJS14dXRuntime,
          handler: "index.handler",
      });

      const result = await lambda.invoke({});
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body, "Hello, World!");
  });
});

/**
 * Property Tests
 */
describe("Property Tests for Lambda Function", () => {
  it("should have memory size of 512MB", async () => {
      const lambda = await aws.lambda.getFunction({ functionName: "my-lambda-function" });
      assert.strictEqual(lambda.memorySize, 512);
  });

  it("should have timeout of 10 seconds", async () => {
      const lambda = await aws.lambda.getFunction({ functionName: "my-lambda-function" });
      assert.strictEqual(lambda.timeout, 10);
  });
});