#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack name prefix
const stackPrefix = 'SparkBoard';

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

// Add stack dependencies
apiStack.addDependency(storageStack);
apiStack.addDependency(authStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'SparkBoard');
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
