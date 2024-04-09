import * as assert from "assert";
import { app, env, cpuAlarm, staticContentBucket, distribution } from "./beanstalk";

/**
 * Unit Tests
 */
describe("Unit Tests for Elastic Beanstalk Application", () => {
    it("should have a valid application name", async () => {
        assert.strictEqual(app.name, "ParlAIWebApp");
    });

    it("should have a valid environment name", async () => {
        assert.strictEqual(env.name, "ParlAIWebEnv");
    });

    it("should have a CPU alarm for monitoring", async () => {
        assert.ok(cpuAlarm.id);
    });

    it("should have a static content bucket", async () => {
        assert.ok(staticContentBucket.id);
    });

    it("should have a CloudFront distribution for CDN", async () => {
        assert.ok(distribution.id);
    });
});

/**
 * Integration Tests
 */
describe("Integration Tests for Elastic Beanstalk Application", () => {
  it("should have a valid environment URL", async () => {
      const ebEnv = await aws.elasticbeanstalk.getEnvironment({
          application: app.name,
          environment: env.name,
      });

      assert.strictEqual(ebEnv.endpointUrl.startsWith("http://"), true);
  });

  it("should have a static content bucket", async () => {
      assert.ok(staticContentBucket.id);
  });

  it("should have a CloudFront distribution for CDN", async () => {
      assert.ok(distribution.id);
  });

  it("should have a valid distribution URL", async () => {
      assert.ok(distribution.domainName.startsWith("http://"));
  });
});

/**
 * Property tests
 */
describe("Property Tests for Elastic Beanstalk Application", () => {
  // Test the application name property
  it("should have a valid application name", async () => {
      assert.strictEqual(app.name, "ParlAIWebApp");
  });

  // Test the environment name property
  it("should have a valid environment name", async () => {
      assert.strictEqual(env.name, "ParlAIWebEnv");
  });

  // Test the CPU alarm properties
  it("should have a valid CPU alarm", async () => {
      assert.ok(cpuAlarm.id);
      assert.strictEqual(cpuAlarm.comparisonOperator, "GreaterThanThreshold");
      assert.strictEqual(cpuAlarm.evaluationPeriods, 2);
      assert.strictEqual(cpuAlarm.metricName, "CPUUtilization");
      assert.strictEqual(cpuAlarm.namespace, "AWS/EC2");
      assert.strictEqual(cpuAlarm.period, 120);
      assert.strictEqual(cpuAlarm.statistic, "Average");
      assert.strictEqual(cpuAlarm.threshold, 70);
      assert.deepStrictEqual(cpuAlarm.alarmActions, [env.arn]);
  });

  // Test the static content bucket properties
  it("should have a valid static content bucket", async () => {
      assert.ok(staticContentBucket.id);
      assert.strictEqual(staticContentBucket.bucket, "staticContentBucket");
  });

  // Test the CloudFront distribution properties
  it("should have a valid CloudFront distribution", async () => {
      assert.ok(distribution.id);
      assert.strictEqual(distribution.enabled, true);
      assert.deepStrictEqual(distribution.origins, [{
          domainName: staticContentBucket.websiteEndpoint,
          originId: staticContentBucket.arn,
      }]);
  });
});