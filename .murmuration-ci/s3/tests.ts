import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as assert from "assert";

// Import the Pulumi program to test
import { bucket } from "./s3-only";

/**
 * Unit Tests
 */
describe("Unit Tests for S3 Bucket", () => {
    it("should have a valid bucket name", async () => {
        assert.strictEqual(bucket.bucketName, "my-test-bucket");
    });

    it("should have versioning enabled", async () => {
        const bucket = await aws.s3.Bucket.get("my-test-bucket");
        assert.strictEqual(bucket.versioning[0].enabled, true);
    });
});

/**
 * Integration Tests
 */
describe("Integration Tests for S3 Website", () => {
  it("should have an S3 website configuration", async () => {
      const bucket = await aws.s3.Bucket.get("my-test-bucket");
      const websiteConfig = bucket.website;

      assert.strictEqual(websiteConfig.indexDocument, "index.html");
      assert.strictEqual(websiteConfig.errorDocument, "error.html");
  });
});

/**
 * Property Tests
 */
describe("Property Tests for S3 Bucket", () => {
  it("should have encryption enabled", async () => {
      const bucket = await aws.s3.Bucket.get("my-test-bucket");

      assert.strictEqual(bucket.serverSideEncryption, "AES256");
  });

  it("should have logging enabled", async () => {
      const bucket = await aws.s3.Bucket.get("my-test-bucket");
      const logging = bucket.logging;

      assert.strictEqual(logging[0].targetBucket, "my-logs-bucket");
      assert.strictEqual(logging[0].targetPrefix, "s3-logs/");
  });
});