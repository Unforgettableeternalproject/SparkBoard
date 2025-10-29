import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  api: apigateway.RestApi;
  lambdaFunctions: lambda.Function[];
  table: dynamodb.Table;
  alarmEmail: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { api, lambdaFunctions, table, alarmEmail } = props;

    // ========================================
    // SNS Topic for Alarms
    // ========================================
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'SparkBoard Alarm Notifications',
      topicName: 'SparkBoard-Alarms',
    });

    // Subscribe email to alarm notifications
    this.alarmTopic.addSubscription(
      new subscriptions.EmailSubscription(alarmEmail)
    );

    // ========================================
    // CloudWatch Alarms
    // ========================================

    // 1. API Gateway 5xx Error Rate Alarm
    const api5xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiRequestsMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Calculate 5xx error rate
    const api5xxRateMetric = new cloudwatch.MathExpression({
      expression: '(m1 / m2) * 100',
      usingMetrics: {
        m1: api5xxMetric,
        m2: apiRequestsMetric,
      },
      period: cdk.Duration.minutes(5),
    });

    const api5xxAlarm = new cloudwatch.Alarm(this, 'API5xxAlarm', {
      alarmName: 'SparkBoard-API-5xx-Rate',
      alarmDescription: 'API Gateway 5xx error rate exceeds 1% for 2 consecutive periods',
      metric: api5xxRateMetric,
      threshold: 1, // 1%
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    api5xxAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // 2. Lambda Errors Alarm (for each function)
    lambdaFunctions.forEach((fn, index) => {
      const errorMetric = fn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      });

      const lambdaErrorAlarm = new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
        alarmName: `SparkBoard-Lambda-${fn.functionName}-Errors`,
        alarmDescription: `Lambda function ${fn.functionName} has errors`,
        metric: errorMetric,
        threshold: 0,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      lambdaErrorAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
    });

    // 3. API Gateway 4xx Rate (for monitoring, not alarm)
    const api4xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // ========================================
    // CloudWatch Dashboard
    // ========================================
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: 'SparkBoard-Monitoring',
      defaultInterval: cdk.Duration.hours(3),
    });

    // Row 1: API Gateway Metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Request Count',
        left: [apiRequestsMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Error Rates',
        left: [api4xxMetric, api5xxMetric],
        width: 12,
        height: 6,
      })
    );

    // Row 2: API Gateway Latency
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Latency',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: {
              ApiName: api.restApiName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        leftYAxis: {
          label: 'Milliseconds',
        },
        width: 24,
        height: 6,
      })
    );

    // Row 3: Lambda Metrics
    const lambdaDurationWidgets: cloudwatch.IWidget[] = [];
    const lambdaErrorWidgets: cloudwatch.IWidget[] = [];

    lambdaFunctions.forEach((fn) => {
      lambdaDurationWidgets.push(
        new cloudwatch.GraphWidget({
          title: `Lambda Duration - ${fn.functionName}`,
          left: [
            fn.metricDuration({
              statistic: 'Average',
              period: cdk.Duration.minutes(5),
            }),
          ],
          leftYAxis: {
            label: 'Milliseconds',
          },
          width: 12,
          height: 6,
        })
      );

      lambdaErrorWidgets.push(
        new cloudwatch.GraphWidget({
          title: `Lambda Errors - ${fn.functionName}`,
          left: [
            fn.metricErrors({
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
            fn.metricThrottles({
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
          ],
          width: 12,
          height: 6,
        })
      );
    });

    // Add Lambda widgets in pairs
    for (let i = 0; i < lambdaDurationWidgets.length; i += 2) {
      const row: cloudwatch.IWidget[] = [lambdaDurationWidgets[i]];
      if (lambdaDurationWidgets[i + 1]) {
        row.push(lambdaDurationWidgets[i + 1]);
      }
      this.dashboard.addWidgets(...row);
    }

    for (let i = 0; i < lambdaErrorWidgets.length; i += 2) {
      const row: cloudwatch.IWidget[] = [lambdaErrorWidgets[i]];
      if (lambdaErrorWidgets[i + 1]) {
        row.push(lambdaErrorWidgets[i + 1]);
      }
      this.dashboard.addWidgets(...row);
    }

    // Row 4: DynamoDB Metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Read/Write Capacity',
        left: [
          table.metricConsumedReadCapacityUnits({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          table.metricConsumedWriteCapacityUnits({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Throttled Requests',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'UserErrors',
            dimensionsMap: {
              TableName: table.tableName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Row 5: Alarm Status
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        title: 'Alarm Status',
        alarms: [
          api5xxAlarm,
          ...lambdaFunctions.map((_, index) => 
            cloudwatch.Alarm.fromAlarmArn(
              this,
              `ImportedAlarm${index}`,
              `arn:aws:cloudwatch:${this.region}:${this.account}:alarm:SparkBoard-Lambda-*-Errors`
            )
          ).filter((_, index) => index === 0) // Just reference the first one as example
        ],
        width: 24,
        height: 4,
      })
    );

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarm notifications',
    });
  }
}
