#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { MessagingStack } from '../lib/messaging-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack name prefix
const stackPrefix = 'SparkBoard';

// Alarm email from context or environment variable
const alarmEmail = app.node.tryGetContext('alarmEmail') || 
                  process.env.ALARM_EMAIL || 
                  'admin@example.com'; // Change this!

// 1. Storage Stack - DynamoDB + S3
const storageStack = new StorageStack(app, `${stackPrefix}-Storage`, {
  env,
  description: 'SparkBoard Storage Layer - DynamoDB Table and S3 Bucket',
});

// 2. Auth Stack - Cognito User Pool
const authStack = new AuthStack(app, `${stackPrefix}-Auth`, {
  env,
  description: 'SparkBoard Authentication - Cognito User Pool',
});

// 3. API Stack - API Gateway + Lambda
const apiStack = new ApiStack(app, `${stackPrefix}-Api`, {
  env,
  description: 'SparkBoard API Layer - API Gateway and Lambda Functions',
  table: storageStack.table,
  bucket: storageStack.bucket,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
});

// 4. Monitoring Stack - CloudWatch Dashboard + Alarms
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
  env,
  description: 'SparkBoard Monitoring - CloudWatch Dashboard and Alarms',
  api: apiStack.api,
  lambdaFunctions: apiStack.lambdaFunctions,
  table: storageStack.table,
  alarmEmail,
});

// 5. Messaging Stack - SQS + SNS + Notification Handler
const messagingStack = new MessagingStack(app, `${stackPrefix}-Messaging`, {
  env,
  description: 'SparkBoard Messaging - SQS Queue, SNS Topic, and Notification Handler',
  table: storageStack.table,
  userPool: authStack.userPool,
});

// 6. Frontend Stack - S3 + CloudFront
const frontendStack = new FrontendStack(app, `${stackPrefix}-Frontend`, {
  env,
  description: 'SparkBoard Frontend - S3 Static Website with CloudFront CDN',
  apiUrl: apiStack.api.url,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  cognitoDomain: `sparkboard-${process.env.CDK_DEFAULT_ACCOUNT || '434824683139'}.auth.${env.region}.amazoncognito.com`,
});

// Add stack dependencies
apiStack.addDependency(storageStack);
apiStack.addDependency(authStack);
monitoringStack.addDependency(apiStack);
messagingStack.addDependency(storageStack);
messagingStack.addDependency(authStack);

// Configure Items Lambda with notification queue
apiStack.setNotificationQueue(
  messagingStack.notificationQueue.queueUrl,
  messagingStack.notificationQueue.queueArn
);

frontendStack.addDependency(apiStack);
frontendStack.addDependency(authStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'SparkBoard');
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
