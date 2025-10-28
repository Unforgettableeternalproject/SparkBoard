import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  bucket: s3.Bucket;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly healthFunction: lambda.Function;
  public readonly authFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { table, bucket, userPool, userPoolClient } = props;

    // Lambda Layer for shared dependencies (optional, for now using inline)
    // You can add AWS SDK v3 clients here later

    // Health Check Lambda Function
    this.healthFunction = new lambda.Function(this, 'HealthFunction', {
      functionName: 'SparkBoard-Health',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/health')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        BUCKET_NAME: bucket.bucketName,
        USER_POOL_ID: userPool.userPoolId,
        NODE_ENV: 'production',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Auth Me Lambda Function
    this.authFunction = new lambda.Function(this, 'AuthMeFunction', {
      functionName: 'SparkBoard-AuthMe',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/auth')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        USER_POOL_ID: userPool.userPoolId,
        NODE_ENV: 'production',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions
    table.grantReadData(this.healthFunction); // Health check only reads
    table.grantReadWriteData(this.authFunction); // Auth can write user data

    // API Gateway REST API
    this.api = new apigateway.RestApi(this, 'SparkBoardApi', {
      restApiName: 'SparkBoard API',
      description: 'SparkBoard Serverless API',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Update with your frontend domain
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      cloudWatchRole: true,
    });

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [userPool],
        authorizerName: 'SparkBoardAuthorizer',
        identitySource: 'method.request.header.Authorization',
      }
    );

    // Health endpoint - GET /health (no auth required)
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.healthFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
      }
    );

    // Auth endpoints - /auth/*
    const authResource = this.api.root.addResource('auth');
    
    // GET /auth/me (requires Cognito JWT)
    const authMeResource = authResource.addResource('me');
    authMeResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.authFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL (with trailing slash)',
      exportName: 'SparkBoard-ApiUrl',
    });

    new cdk.CfnOutput(this, 'ApiBaseUrl', {
      value: this.api.url.replace(/\/$/, ''), // Remove trailing slash
      description: 'API Base URL (without trailing slash)',
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: 'SparkBoard-ApiId',
    });

    new cdk.CfnOutput(this, 'HealthEndpoint', {
      value: `${this.api.url}health`,
      description: 'Health Check Endpoint',
    });

    new cdk.CfnOutput(this, 'AuthMeEndpoint', {
      value: `${this.api.url}auth/me`,
      description: 'Auth Me Endpoint (requires JWT)',
    });
  }
}
