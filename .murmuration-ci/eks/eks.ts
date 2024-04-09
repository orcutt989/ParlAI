import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";

// Create an EKS cluster
export const cluster = new eks.Cluster("eksCluster", {
    vpcId: aws_vpc.id,
    subnetIds: [aws_subnet.id],
    instanceType: "t2.micro",
    desiredCapacity: 2,
    minSize: 1,
    maxSize: 3,
});

// Define the Dockerfile content for the custom image
export const dockerfileContent = `
    FROM python:3.9-alpine
    WORKDIR /app
    RUN apk --no-cache add git && \\
        git clone https://github.com/facebookresearch/ParlAI.git && \\
        cd ParlAI && \\
        git checkout main && \\
        pip install -r requirements.txt && \\
        python setup.py develop && \\
        python ParlAI/website/generate.py && \\
        pip uninstall -y awscli && \\
        apk del git && \\
        rm -rf /var/cache/apk/*
    EXPOSE 80
    CMD ["python", "-m", "http.server", "80", "--directory", "ParlAI/website/build"]
`;

// Create an Amazon ECR repository for the Docker image
const ecrRepository = new aws.ecr.Repository("parlaiWebDeploy");

// Build the Docker image and push it to Amazon ECR
const dockerImage = new aws.ecr.DockerImage("parlaiWebImage", {
    imageName: pulumi.interpolate`${ecrRepository.repositoryUrl}:latest`,
    build: {
        context: pulumi.interpolate`${pulumi.getProject()}-${pulumi.getStack()}`, // Use a unique build context
        dockerfile: pulumi.output(dockerfileContent),
    },
});

// Create a Kubernetes deployment for the ParlAI web server
const webServerDeployment = new k8s.apps.v1.Deployment("webServerDeployment", {
    metadata: { labels: { app: "parlai-web-server" } },
    spec: {
        replicas: 2,
        selector: { matchLabels: { app: "parlai-web-server" } },
        template: {
            metadata: { labels: { app: "parlai-web-server" } },
            spec: {
                containers: [{
                    name: "parlai-web-server",
                    image: pulumi.interpolate`${dockerImage.imageName}`,
                    ports: [{ containerPort: 80 }],
                }],
            },
        },
    },
}, { provider: cluster.provider });

// Expose the web server deployment via a Kubernetes service
const webServerService = new k8s.core.v1.Service("webServerService", {
    metadata: { labels: { app: "parlai-web-server" } },
    spec: {
        type: "LoadBalancer",
        ports: [{ port: 80, targetPort: 80 }],
        selector: { app: "parlai-web-server" },
    },
}, { provider: cluster.provider });

// Create a CloudWatch alarm for monitoring system metrics
const cpuAlarm = new aws.cloudwatch.MetricAlarm("cpuAlarm", {
    comparisonOperator: "GreaterThanThreshold",
    evaluationPeriods: 2,
    metricName: "CPUUtilization",
    namespace: "AWS/EC2",
    period: 120,
    statistic: "Average",
    threshold: 70,
    alarmActions: [cluster.nodeGroup.nodeInstanceRole.apply(role => role.arn)],
});

// Create an S3 bucket for static content
const bucket = new aws.s3.Bucket("websiteBucket");

// Create a CloudFront distribution for the CDN
const distribution = new aws.cloudfront.Distribution("cdnDistribution", {
    origins: [{
        domainName: bucket.websiteEndpoint,
        originId: bucket.arn,
    }],
    defaultRootObject: "index.html",
    enabled: true,
});

// Create a Kubernetes Job to deploy the website
const deployJob = new k8s.batch.v1.Job("deployJob", {
    spec: {
        template: {
            metadata: { labels: { app: "parlai-web-server" } },
            spec: {
                containers: [{
                    name: "deploy-container",
                    image: pulumi.interpolate`${dockerImage.imageName}`,
                    imagePullPolicy: "Always", // Always pull the latest image
                    volumeMounts: [{
                        name: "app-volume",
                        mountPath: "/app",
                    }],
                }],
                volumes: [{
                    name: "app-volume",
                    emptyDir: {},
                }],
                restartPolicy: "Never",
            },
        },
    },
}, { provider: cluster.provider });

// Add a dependency between the deployment and the web server pods
webServerDeployment.dependsOn(deployJob);

// Export the EKS cluster's kubeconfig for Kubernetes operations
export const kubeconfig = cluster.kubeconfig;
