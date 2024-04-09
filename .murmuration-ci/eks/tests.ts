import * as assert from "assert";
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";

import { cluster, dockerfileContent } from "./eks"

/**
 * Unit Tests
 */
describe("EKS Cluster", () => {
  it("should create an EKS cluster with desired capacity 2", async () => {
      assert.strictEqual(cluster.desiredCapacity, 2);
  });

  it("should use t2.micro instances in the EKS cluster", async () => {
      assert.strictEqual(cluster.instanceType, "t2.micro");
  });
});

// Unit test for Dockerfile content
describe("Dockerfile", () => {
  it("should contain Python 3.9 in Dockerfile content", async () => {
      assert.ok(dockerfileContent.includes("FROM python:3.9-alpine"));
  });

  it("should expose port 80 in Dockerfile content", async () => {
      assert.ok(dockerfileContent.includes("EXPOSE 80"));
  });
});

/**
 * Integration Tests
 */
describe("Kubernetes Integration", () => {
  it("should create a Kubernetes deployment with 2 replicas", async () => {
      const deployment = await k8s.apps.v1.Deployment.get("webServerDeployment", cluster.provider);
      assert.strictEqual(deployment.spec.replicas, 2);
  });

  it("should create a Kubernetes service with type LoadBalancer", async () => {
      const service = await k8s.core.v1.Service.get("webServerService", cluster.provider);
      assert.strictEqual(service.spec.type, "LoadBalancer");
  });
});


/**
 * Property Tests
 */
describe("CloudWatch Alarm", () => {
  it("should create a CloudWatch alarm for CPUUtilization", async () => {
      const alarm = await aws.cloudwatch.MetricAlarm.get("cpuAlarm", cluster.provider);
      assert.strictEqual(alarm.metricName, "CPUUtilization");
  });

  it("should set evaluation periods to 2 in the CloudWatch alarm", async () => {
      const alarm = await aws.cloudwatch.MetricAlarm.get("cpuAlarm", cluster.provider);
      assert.strictEqual(alarm.evaluationPeriods, 2);
  });
});