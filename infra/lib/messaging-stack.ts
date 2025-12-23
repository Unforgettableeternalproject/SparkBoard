import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as path from 'path';

interface MessagingStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
  userPool: cognito.IUserPool;
}

export class MessagingStack extends cdk.Stack {
  public readonly notificationQueue: sqs.Queue;
  public readonly notificationTopic: sns.Topic;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: MessagingStackProps) {
    super(scope, id, props);

    // Dead Letter Queue for failed messages
    this.deadLetterQueue = new sqs.Queue(this, 'NotificationDLQ', {
      queueName: 'SparkBoard-Notification-DLQ',
      retentionPeriod: cdk.Duration.days(14),
    });

    // Main notification queue
    this.notificationQueue = new sqs.Queue(this, 'NotificationQueue', {
      queueName: 'SparkBoard-Notification-Queue',
      visibilityTimeout: cdk.Duration.seconds(300), // 5 minutes
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3, // Retry 3 times before moving to DLQ
      },
    });

    // SNS Topic for email notifications
    this.notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      topicName: 'SparkBoard-Notifications',
      displayName: 'SparkBoard Task Notifications',
    });

    // Lambda function to process notification queue
    const notificationHandler = new lambda.Function(this, 'NotificationHandler', {
      functionName: 'SparkBoard-NotificationHandler',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/notifications')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: props.table.tableName,
        SNS_TOPIC_ARN: this.notificationTopic.topicArn,
        USER_POOL_ID: props.userPool.userPoolId,
      },
    });

    // Grant permissions
    props.table.grantReadData(notificationHandler);
    this.notificationTopic.grantPublish(notificationHandler);
    
    // Add Cognito permissions
    notificationHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminGetUser',
        'cognito-idp:ListUsers',
      ],
      resources: [props.userPool.userPoolArn],
    }));

    // Configure SQS as event source for Lambda
    notificationHandler.addEventSource(new lambdaEventSources.SqsEventSource(this.notificationQueue, {
      batchSize: 10, // Process up to 10 messages at once
      maxBatchingWindow: cdk.Duration.seconds(5),
    }));

    // Outputs
    new cdk.CfnOutput(this, 'NotificationQueueUrl', {
      value: this.notificationQueue.queueUrl,
      description: 'SQS Notification Queue URL',
      exportName: 'SparkBoard-NotificationQueueUrl',
    });

    new cdk.CfnOutput(this, 'NotificationQueueArn', {
      value: this.notificationQueue.queueArn,
      description: 'SQS Notification Queue ARN',
      exportName: 'SparkBoard-NotificationQueueArn',
    });

    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: this.notificationTopic.topicArn,
      description: 'SNS Notification Topic ARN',
      exportName: 'SparkBoard-NotificationTopicArn',
    });
  }
}
