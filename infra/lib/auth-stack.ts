import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.IUserPool;
  public readonly userPoolClient: cognito.IUserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Step 1: Create Post Confirmation Lambda first (no dependencies)
    const postConfirmTrigger = new lambda.Function(this, 'PostConfirmTrigger', {
      functionName: 'SparkBoard-PostConfirm',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/auth-trigger')),
      timeout: cdk.Duration.seconds(10),
      tracing: lambda.Tracing.ACTIVE,
    });

    // Step 2: Create User Pool using CFN construct (full control over dependencies)
    const cfnUserPool = new cognito.CfnUserPool(this, 'SparkBoardUserPool', {
      userPoolName: 'SparkBoardUserPool',
      adminCreateUserConfig: {
        allowAdminCreateUserOnly: false,
      },
      aliasAttributes: ['email'],
      autoVerifiedAttributes: ['email'],
      emailVerificationMessage: 'The verification code to your new account is {####}',
      emailVerificationSubject: 'Verify your new account',
      policies: {
        passwordPolicy: {
          minimumLength: 8,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: false,
          requireUppercase: true,
        },
      },
      schema: [
        {
          attributeDataType: 'String',
          name: 'email',
          required: true,
          mutable: true,
        },
        {
          attributeDataType: 'String',
          name: 'name',
          required: false,
          mutable: true,
        },
        {
          attributeDataType: 'String',
          name: 'orgId',
          required: false,
          mutable: true,
          stringAttributeConstraints: {
            minLength: '1',
            maxLength: '256',
          },
        },
      ],
      userPoolTags: {
        Project: 'SparkBoard',
        ManagedBy: 'CDK',
      },
      accountRecoverySetting: {
        recoveryMechanisms: [
          {
            name: 'verified_email',
            priority: 1,
          },
        ],
      },
    });
    cfnUserPool.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Step 3: Grant Lambda permission to be invoked by Cognito (no sourceArn to avoid circular dependency)
    const lambdaPermission = new lambda.CfnPermission(this, 'CognitoInvokePermission', {
      action: 'lambda:InvokeFunction',
      functionName: postConfirmTrigger.functionArn,
      principal: 'cognito-idp.amazonaws.com',
    });

    // Step 4: Attach Lambda trigger to User Pool (both PostConfirmation and PostAuthentication)
    cfnUserPool.lambdaConfig = {
      postConfirmation: postConfirmTrigger.functionArn,
      postAuthentication: postConfirmTrigger.functionArn,
    };

    // Wrap CFN User Pool in IUserPool interface for compatibility
    this.userPool = cognito.UserPool.fromUserPoolId(this, 'UserPoolRef', cfnUserPool.ref);
    
    // Step 5: Grant Lambda permissions to manage User Pool (use wildcard to avoid circular dependency)
    postConfirmTrigger.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminListGroupsForUser',
        'cognito-idp:ListUsers',
      ],
      resources: [`arn:aws:cognito-idp:${this.region}:${this.account}:userpool/*`],
    }));

    // Step 6: Create User Groups
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: cfnUserPool.ref,
      groupName: 'Admin',
      description: 'Administrators with full system access including monitoring',
      precedence: 1,
    });

    new cognito.CfnUserPoolGroup(this, 'ModeratorsGroup', {
      userPoolId: cfnUserPool.ref,
      groupName: 'Moderators',
      description: 'Moderators can create announcements and manage tasks',
      precedence: 2,
    });

    new cognito.CfnUserPoolGroup(this, 'UsersGroup', {
      userPoolId: cfnUserPool.ref,
      groupName: 'Users',
      description: 'Standard users with basic access',
      precedence: 3,
    });

    // Step 7: Create User Pool Client with OAuth support for Hosted UI
    const cfnClient = new cognito.CfnUserPoolClient(this, 'SparkBoardWebClient', {
      userPoolId: cfnUserPool.ref,
      clientName: 'SparkBoardWebClient',
      explicitAuthFlows: [
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_ADMIN_USER_PASSWORD_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ],
      generateSecret: false,
      preventUserExistenceErrors: 'ENABLED',
      accessTokenValidity: 60, // minutes
      idTokenValidity: 60, // minutes
      refreshTokenValidity: 30, // days
      tokenValidityUnits: {
        accessToken: 'minutes',
        idToken: 'minutes',
        refreshToken: 'days',
      },
      // OAuth configuration for Hosted UI
      allowedOAuthFlows: ['code', 'implicit'],
      allowedOAuthFlowsUserPoolClient: true,
      allowedOAuthScopes: [
        'phone',
        'email',
        'openid',
        'profile',
        'aws.cognito.signin.user.admin',
      ],
      callbackUrLs: [
        'http://localhost:5173',
        'http://localhost:5173/',
        'https://dil6s218sdym2.cloudfront.net',
        'https://dil6s218sdym2.cloudfront.net/',
      ],
      logoutUrLs: [
        'http://localhost:5173',
        'http://localhost:5173/',
        'https://dil6s218sdym2.cloudfront.net',
        'https://dil6s218sdym2.cloudfront.net/',
      ],
      supportedIdentityProviders: ['COGNITO'],
    });
    
    this.userPoolClient = cognito.UserPoolClient.fromUserPoolClientId(
      this,
      'UserPoolClientRef',
      cfnClient.ref
    );

    // Step 8: Create Hosted UI Domain
    const cfnDomain = new cognito.CfnUserPoolDomain(this, 'SparkBoardDomain', {
      domain: `sparkboard-${this.account}`,
      userPoolId: cfnUserPool.ref,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: cfnUserPool.ref,
      description: 'Cognito User Pool ID',
      exportName: 'SparkBoard-UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: cfnUserPool.attrArn,
      description: 'Cognito User Pool ARN',
      exportName: 'SparkBoard-UserPoolArn',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: cfnClient.ref,
      description: 'Cognito User Pool Client ID',
      exportName: 'SparkBoard-UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'HostedUIUrl', {
      value: `https://${cfnDomain.domain}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Hosted UI Base URL',
    });

    new cdk.CfnOutput(this, 'LoginUrl', {
      value: `https://${cfnDomain.domain}.auth.${this.region}.amazoncognito.com/login?client_id=${cfnClient.ref}&response_type=code&redirect_uri=http://localhost:5173`,
      description: 'Cognito Hosted UI Login URL',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });
  }
}
