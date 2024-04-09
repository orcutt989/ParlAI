import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Temporary directory to clone the repository and build the website
const tempDir = tmp.dirSync();
const repoDir = `${tempDir.name}/repo`;

// Clone the repository into the temporary directory
const repository = "https://github.com/facebookresearch/ParlAI.git";
const repo = new pulumi.process.Executable("clone-repo", {
    command: "git",
    args: ["clone", repository, repoDir],
});

// Run generate.py to build the website
const buildCmd = new pulumi.process.Executable("build-website", {
    command: "python",
    args: ["generate.py"],
    cwd: `${repoDir}/website`,
    env: { PYTHONPATH: `${repoDir}` }, // Set PYTHONPATH to locate generate.py dependencies
});

// Upload the built website content to a Lambda deployment package
const websiteDir = `${repoDir}/website/build`;
const websiteFiles = fs.readdirSync(websiteDir);
const lambdaAssets = websiteFiles.map(file => new pulumi.asset.FileAsset(`${websiteDir}/${file}`));

// Create an AWS Lambda function to serve the static content
export const lambdaFunction = new aws.lambda.Function("staticSiteLambda", {
    code: new pulumi.asset.AssetArchive({
        ".": pulumi.all(lambdaAssets).apply(files =>
            files.reduce((acc, file) => ({ ...acc, [file.basename || ""]: file }), {})
        ),
    }),
    handler: "index.handler",
    runtime: aws.lambda.Runtime.NodeJS14dX,
});

// Create an Amazon CloudWatch alarm for monitoring Lambda errors
const lambdaErrorsAlarm = new aws.cloudwatch.MetricAlarm("lambdaErrorsAlarm", {
    alarmName: "LambdaErrorsAlarm",
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 1,
    metricName: "Errors",
    namespace: "AWS/Lambda",
    period: 60,
    statistic: "Sum",
    threshold: 1,
    alarmActions: [lambdaFunction.arn],
});

// Create an Amazon CloudFront distribution for caching and CDN
const cloudfrontDistribution = new aws.cloudfront.Distribution("cloudfrontDistribution", {
    origins: [
        {
            domainName: lambdaFunction.invokeArn.apply(arn => `lambda://${arn}`),
            originId: "lambdaFunctionOrigin",
        },
    ],
    defaultRootObject: "index.html", // Default root object for static content
    enabled: true,
    defaultCacheBehavior: {
        targetOriginId: "lambdaFunctionOrigin",
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        forwardedValues: {
            queryString: true,
            cookies: { forward: "none" },
        },
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
    },
    loggingConfig: {
        bucket: aws.s3.Bucket.get("cloudfrontLogsBucket", "logs-id").bucketDomainName,
        includeCookies: false,
        prefix: "cloudfront-logs/",
    },
});

// Export the CloudFront distribution domain name for accessing the website
export const websiteUrl = pulumi.interpolate`https://${cloudfrontDistribution.domainName}`;
