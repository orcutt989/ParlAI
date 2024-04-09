import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from "fs";
import * as tmp from "tmp";

// Create an S3 bucket for the website
export const bucket = new aws.s3.Bucket("website-bucket", {
    website: {
        indexDocument: "index.html", // Set the index document
        errorDocument: "error.html", // Set the error document
    },
});

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

// Upload the built website content to the S3 bucket
const websiteDir = `${repoDir}/website/build`;
const websiteFiles = fs.readdirSync(websiteDir);
for (const file of websiteFiles) {
    const filePath = `${websiteDir}/${file}`;
    const object = new aws.s3.BucketObject(file, {
        bucket: bucket,
        source: new pulumi.asset.FileAsset(filePath),
        contentType: mime.getType(filePath) || undefined,
    });
}

// Create a CloudFront distribution for the CDN
const distribution = new aws.cloudfront.Distribution("website-cdn", {
    origin: {
        domainName: bucket.websiteEndpoint,
        originId: bucket.arn,
        s3OriginConfig: {
            originAccessIdentity: "",
        },
    },
    enabled: true,
    defaultRootObject: "index.html",
    defaultCacheBehavior: {
        targetOriginId: "S3-origin",
        viewerProtocolPolicy: "allow-all",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD", "OPTIONS"],
        forwardedValues: {
            queryString: false,
            cookies: {
                forward: "none",
            },
        },
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
    },
    restrictions: {
        geoRestriction: {
            restrictionType: "none",
        },
    },
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
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
    alarmActions: [bucket.arn],
});

// Export the CloudFront domain name for accessing the website
export const websiteUrl = pulumi.interpolate`http://${distribution.domainName}/`;
