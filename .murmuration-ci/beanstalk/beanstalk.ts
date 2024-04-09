import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create an Elastic Beanstalk application
const appName = "ParlAIWebApp";
export const app = new aws.elasticbeanstalk.Application(appName);

// Create an S3 bucket for storing application source code
const bucket = new aws.s3.Bucket("ebBucket");

// Create an IAM role for AWS CodeBuild
const codeBuildRole = new aws.iam.Role("codeBuildRole", {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: {
                Service: "codebuild.amazonaws.com",
            },
            Action: "sts:AssumeRole",
        }],
    }),
});

// Attach policies to the CodeBuild role (adjust policies as needed)
const codeBuildPolicy = new aws.iam.RolePolicy("codeBuildPolicy", {
    role: codeBuildRole,
    policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Action: [
                "s3:GetObject",
                "s3:PutObject",
                "elasticbeanstalk:UpdateEnvironment",
            ],
            Resource: "*",
        }],
    }),
});

// Create an AWS CodeBuild project
const codeBuildProject = new aws.codebuild.Project("codeBuildProject", {
    buildTimeout: 60,
    environment: {
        computeType: "BUILD_GENERAL1_SMALL",
        image: "aws/codebuild/standard:4.0",
        type: "LINUX_CONTAINER",
    },
    serviceRole: codeBuildRole.arn,
    source: {
        type: "S3",
        location: bucket.bucket,
    },
    artifacts: {
        type: "NO_ARTIFACTS",
    },
    // Specify the build commands to clone the repository and build the website
    buildSpec: `
        version: 0.2
        phases:
          install:
            runtime-versions:
              python: 3.9
          build:
            commands:
              - git clone https://github.com/facebookresearch/ParlAI.git
              - cd ParlAI
              - git checkout main
              - pip install -r requirements.txt
              - python setup.py develop
              - python ParlAI/website/generate.py
              - aws elasticbeanstalk update-environment --application-name ${appName} --environment-name ${envName} --version-label ${aws.elasticbeanstalk.ApplicationVersion.ebAppVer.name}
    `,
});

// Upload the website files to the S3 bucket
const websiteDir = new pulumi.asset.FileArchive("./path/to/website/build");
const bucketObject = new aws.s3.BucketObject("websiteFiles", {
    bucket: bucket,
    source: websiteDir,
});

// Create an Elastic Beanstalk environment
const envName = "ParlAIWebEnv";
export const env = new aws.elasticbeanstalk.Environment(envName, {
    application: app.name,
    solutionStackName: "64bit Amazon Linux 2 v5.4.2 running Python 3.9",
    // You can change the solution stack name as needed
    // For Python applications, use an appropriate solution stack
    // Check AWS documentation for available solution stacks
    settings: [
        { namespace: "aws:elasticbeanstalk:application:environment", name: "PARAM1", value: "VALUE1" },
    ],
    // Use the S3 bucket to deploy the application source code
    version: {
        bucket: bucket,
        key: bucketObject.key,
    },
});

// Create a CloudWatch alarm for monitoring system metrics
export const cpuAlarm = new aws.cloudwatch.MetricAlarm("cpuAlarm", {
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 2,
    metricName: "CPUUtilization",
    namespace: "AWS/EC2",
    period: 120,
    statistic: "Average",
    threshold: 70,
    alarmActions: [env.arn],
});

// Create an S3 bucket for static content
export const staticContentBucket = new aws.s3.Bucket("staticContentBucket");

// Create a CloudFront distribution for the CDN
export const distribution = new aws.cloudfront.Distribution("cdnDistribution", {
    origins: [{
        domainName: staticContentBucket.websiteEndpoint,
        originId: staticContentBucket.arn,
    }],
    defaultRootObject: "index.html",
    enabled: true,
});

// Export the application and environment details
export const applicationName = app.name;
export const environmentName = env.name;
export const websiteUrl = env.endpointUrl;
