import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as assert from "assert";

// Mock Amplify application
const mockAmplifyApp = new aws.amplify.App("mockAmplifyApp", {
    name: "test-amplify-app",
});

/**
 * Unit Tests
 */
describe("Amplify App", () => {
  it("should create an Amplify application", async () => {
      assert.strictEqual(mockAmplifyApp.name, "test-amplify-app");
  });
});

// Mock Amplify domain
const mockAmplifyDomain = new aws.amplify.Domain("mockAmplifyDomain", {
  domainName: "example.com",
  appId: mockAmplifyApp.id,
});

// Unit test for Amplify domain creation
describe("Amplify Domain", () => {
  it("should create an Amplify domain", async () => {
      assert.strictEqual(mockAmplifyDomain.domainName, "example.com");
  });
});

/**
 * Integration Tests
 */
describe("Amplify Domain Integration", () => {
  it("should connect Amplify domain to CloudFront", async () => {
      const cloudfrontDistribution = new aws.cloudfront.Distribution("testCloudfront", {
          origins: [{
              domainName: mockAmplifyDomain.domainName,
              originId: "amplifyOrigin",
          }],
          defaultRootObject: "index.html",
          enabled: true,
      });

      await pulumi.all([cloudfrontDistribution.arn, mockAmplifyDomain.domainName]).apply(([arn, domain]) => {
          assert.strictEqual(cloudfrontDistribution.arn, arn);
          assert.strictEqual(domain, "example.com");
      });
  });
});

/**
 * Property Tests
 */
describe("Amplify Environment Settings", () => {
  it("should have correct environment settings", async () => {
      const amplifyEnv = new aws.amplify.Branch("testAmplifyEnv", {
          appId: mockAmplifyApp.id,
          branchName: "main",
      });

      await pulumi.all([amplifyEnv.appId, amplifyEnv.branchName]).apply(([appId, branchName]) => {
          assert.strictEqual(appId, mockAmplifyApp.id);
          assert.strictEqual(branchName, "main");
      });
  });
});