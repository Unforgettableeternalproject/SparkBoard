import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
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
  public readonly itemsFunction: lambda.Function;
  public readonly uploadsFunction: lambda.Function;
  public readonly monitoringFunction: lambda.Function;
  public readonly lambdaFunctions: lambda.Function[];

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
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray
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
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray
    });

    // Items Lambda Function
    this.itemsFunction = new lambda.Function(this, 'ItemsFunction', {
      functionName: 'SparkBoard-Items',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/items')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
      environment: {
        TABLE_NAME: table.tableName,
        NODE_ENV: 'production',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray
    });

    // Uploads Lambda Function
    this.uploadsFunction = new lambda.Function(this, 'UploadsFunction', {
      functionName: 'SparkBoard-Uploads',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/uploads')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        BUCKET_NAME: bucket.bucketName,
        NODE_ENV: 'production',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray
    });

    // Monitoring Lambda Function (for admin dashboard)
    this.monitoringFunction = new lambda.Function(this, 'MonitoringFunction', {
      functionName: 'SparkBoard-Monitoring',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/monitoring')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        TABLE_NAME: table.tableName,
        API_ID: '', // Will be set after API creation
        NODE_ENV: 'production',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });

    // Users Lambda Function (for admin user management)
    const usersFunction = new lambda.Function(this, 'UsersFunction', {
      functionName: 'SparkBoard-Users',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/users')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        NODE_ENV: 'production',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant Cognito permissions to users function
    usersFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:ListUsers',
        'cognito-idp:AdminListGroupsForUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminRemoveUserFromGroup',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminDisableUser',
        'cognito-idp:AdminEnableUser',
        'cognito-idp:AdminDeleteUser',
      ],
      resources: [userPool.userPoolArn],
    }));

    // Collect all functions for monitoring
    this.lambdaFunctions = [
      this.healthFunction,
      this.authFunction,
      this.itemsFunction,
      this.uploadsFunction,
      this.monitoringFunction,
      usersFunction,
    ];

    // Grant permissions
    table.grantReadData(this.healthFunction); // Health check only reads
    table.grantReadWriteData(this.authFunction); // Auth can write user data
    table.grantReadWriteData(this.itemsFunction); // Items needs read/write access
    bucket.grantPut(this.uploadsFunction); // Uploads can generate presigned PUT URLs
    bucket.grantRead(this.uploadsFunction); // Uploads can also read for validation

    // Grant Cognito permissions to auth function for updating user attributes
    this.authFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:AdminGetUser',
      ],
      resources: [userPool.userPoolArn],
    }));

    // API Gateway REST API
    this.api = new apigateway.RestApi(this, 'SparkBoardApi', {
      restApiName: 'SparkBoard API',
      description: 'SparkBoard Serverless API',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true, // Enable X-Ray for API Gateway
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

    // PATCH /auth/me (requires Cognito JWT) - Update user profile
    authMeResource.addMethod(
      'PATCH',
      new apigateway.LambdaIntegration(this.authFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // Items endpoints - /items
    const itemsResource = this.api.root.addResource('items');
    
    // POST /items (requires Cognito JWT)
    itemsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(this.itemsFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // GET /items (requires Cognito JWT)
    itemsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.itemsFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // DELETE /items/{sk} (requires Cognito JWT)
    const itemBySkResource = itemsResource.addResource('{sk}');
    itemBySkResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(this.itemsFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // PATCH /items/{sk} (requires Cognito JWT) - Update task/announcement
    itemBySkResource.addMethod(
      'PATCH',
      new apigateway.LambdaIntegration(this.itemsFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // Uploads endpoints - /uploads/*
    const uploadsResource = this.api.root.addResource('uploads');
    
    // POST /uploads/presign (requires Cognito JWT)
    const presignResource = uploadsResource.addResource('presign');
    presignResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(this.uploadsFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // Monitoring endpoints - /monitoring/* (Admin only)
    const monitoringResource = this.api.root.addResource('monitoring');
    
    // GET /monitoring/metrics (requires Cognito JWT + Admin role)
    const metricsResource = monitoringResource.addResource('metrics');
    metricsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.monitoringFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // GET /monitoring/traces (requires Cognito JWT + Admin role)
    const tracesResource = monitoringResource.addResource('traces');
    tracesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.monitoringFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // GET /monitoring/alarms (requires Cognito JWT + Admin role)
    const alarmsResource = monitoringResource.addResource('alarms');
    alarmsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.monitoringFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // Users endpoints - /users/* (Admin only)
    const usersResource = this.api.root.addResource('users');
    
    // GET /users (requires Cognito JWT + Admin role)
    usersResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(usersFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // POST /users/add-to-group (requires Cognito JWT + Admin role)
    const addToGroupResource = usersResource.addResource('add-to-group');
    addToGroupResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(usersFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // POST /users/remove-from-group (requires Cognito JWT + Admin role)
    const removeFromGroupResource = usersResource.addResource('remove-from-group');
    removeFromGroupResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(usersFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // POST /users/disable (requires Cognito JWT + Admin role)
    const disableUserResource = usersResource.addResource('disable');
    disableUserResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(usersFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // POST /users/enable (requires Cognito JWT + Admin role)
    const enableUserResource = usersResource.addResource('enable');
    enableUserResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(usersFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // DELETE /users (requires Cognito JWT + Admin role)
    usersResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(usersFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: cognitoAuthorizer,
      }
    );

    // Update monitoring function environment with API ID
    this.monitoringFunction.addEnvironment('API_ID', this.api.restApiId);

    // Grant CloudWatch permissions to monitoring function
    this.monitoringFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudwatch:GetMetricStatistics',
          'cloudwatch:DescribeAlarms',
          'cloudwatch:ListMetrics',
        ],
        resources: ['*'],
      })
    );

    // Grant X-Ray permissions to monitoring function
    this.monitoringFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'xray:GetTraceSummaries',
          'xray:BatchGetTraces',
          'xray:GetServiceGraph',
        ],
        resources: ['*'],
      })
    );

    // Grant Logs permissions to monitoring function
    this.monitoringFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:FilterLogEvents',
          'logs:GetLogEvents',
          'logs:DescribeLogStreams',
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/SparkBoard-*`,
        ],
      })
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

    new cdk.CfnOutput(this, 'ItemsEndpoint', {
      value: `${this.api.url}items`,
      description: 'Items Endpoint (requires JWT)',
    });

    new cdk.CfnOutput(this, 'UploadsEndpoint', {
      value: `${this.api.url}uploads/presign`,
      description: 'Uploads Presign Endpoint (requires JWT)',
    });
  }
}
