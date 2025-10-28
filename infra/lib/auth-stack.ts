import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'SparkBoardUserPool', {
      userPoolName: 'SparkBoardUserPool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        orgId: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 256,
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev only
    });

    // Hosted UI Domain
    const domain = this.userPool.addDomain('SparkBoardDomain', {
      cognitoDomain: {
        domainPrefix: `sparkboard-${this.account}`, // Must be globally unique
      },
    });

    // User Pool Client (for frontend)
    this.userPoolClient = new cognito.UserPoolClient(this, 'SparkBoardWebClient', {
      userPool: this.userPool,
      userPoolClientName: 'SparkBoardWebClient',
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true, // Enable ADMIN_NO_SRP_AUTH for testing
      },
      generateSecret: false, // Public client (frontend)
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false, // Not recommended for security
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:5173',
          'http://localhost:5173/',
          'http://localhost:5173/callback',
        ],
        logoutUrls: [
          'http://localhost:5173',
          'http://localhost:5173/',
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'SparkBoard-UserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: 'SparkBoard-UserPoolArn',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'SparkBoard-UserPoolClientId',
    });

    new cdk.CfnOutput(this, 'HostedUIUrl', {
      value: `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Hosted UI Base URL',
    });

    new cdk.CfnOutput(this, 'LoginUrl', {
      value: `https://${domain.domainName}.auth.${this.region}.amazoncognito.com/login?client_id=${this.userPoolClient.userPoolClientId}&response_type=code&redirect_uri=http://localhost:5173`,
      description: 'Cognito Hosted UI Login URL',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });
  }
}
