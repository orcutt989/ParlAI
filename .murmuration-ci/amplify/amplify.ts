import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create an S3 bucket for storing website files
const bucket = new aws.s3.Bucket("staticSiteBucket");

// Define the build commands to generate the website
const buildCommands = [
    "git clone https://github.com/facebookresearch/ParlAI.git",
    "cd ParlAI",
    "git checkout main",
    "pip install -r requirements.txt",
    "python setup.py develop",
    "python ParlAI/website/generate.py",
];

// Create a CodeBuild project to build the website
const codeBuildProject = new aws.codebuild.Project("websiteCodeBuildProject", {
    buildTimeout: 60,
    environment: {
        computeType: "BUILD_GENERAL1_SMALL",
        image: "aws/codebuild/standard:4.0",
        type: "LINUX_CONTAINER",
    },
    source: {
        type: "NO_SOURCE", // Build commands will be provided directly
    },
    artifacts: {
        type: "NO_ARTIFACTS",
    },
    cache: {
        type: "NO_CACHE",
    },
    buildSpec: pulumi.interpolate`version: 0.2
phases:
  install:
    commands:
      - git clone https://github.com/facebookresearch/ParlAI.git
      - cd ParlAI
      - git checkout main
      - pip install -r requirements.txt
      - python setup.py develop
  build:
    commands:
      ${buildCommands.map(cmd => `      - ${cmd}`).join("\n")}`,
});

// Grant permissions for the CodeBuild project to access the S3 bucket
const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
    bucket: bucket.bucket,
    policy: bucket.bucket.apply(bucketName =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        Service: "codebuild.amazonaws.com",
                    },
                    Action: "s3:GetObject",
                    Resource: `arn:aws:s3:::${bucketName}/*`,
                },
            ],
        })
    ),
});

// Create a CloudWatch alarm for monitoring system metrics
const cpuAlarm = new aws.cloudwatch.MetricAlarm("cpuAlarm", {
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 2,
    metricName: "CPUUtilization",
    namespace: "AWS/EC2",
    period: 120,
    statistic: "Average",
    threshold: 70,
    alarmActions: [codeBuildProject.arn],
});

// Export the S3 bucket name and CodeBuild project details
export const bucketName = bucket.bucket;
export const projectArn = codeBuildProject.arn;
