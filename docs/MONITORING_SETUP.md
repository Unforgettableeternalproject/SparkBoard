# Monitoring Setup Guide

This guide explains how to set up and use the monitoring dashboard for SparkBoard.

## Overview

The monitoring system consists of:

1. **CloudWatch Dashboard**: Visual metrics for API Gateway, Lambda, and DynamoDB
2. **CloudWatch Alarms**: Automated alerts for critical issues
3. **X-Ray Tracing**: Distributed tracing for request paths
4. **Monitoring API**: Backend endpoints to query metrics, traces, and alarms
5. **Admin Dashboard**: React frontend for viewing monitoring data

## Infrastructure Components

### 1. CloudWatch Dashboard

Located at: `infra/lib/monitoring-stack.ts`

**Metrics displayed:**
- API Gateway: Request count, 4xx/5xx error rates, latency
- Lambda Functions: Duration, errors, throttles (per function)
- DynamoDB: Read/write capacity, throttles
- Alarm Status: Current state of all alarms

### 2. CloudWatch Alarms

**API Gateway 5xx Rate Alarm:**
- Threshold: >1% error rate
- Evaluation: 2 consecutive periods (10 minutes)
- Action: SNS email notification

**Lambda Error Alarms:**
- One alarm per Lambda function
- Threshold: >0 errors
- Evaluation: 2 consecutive periods (10 minutes)
- Action: SNS email notification

### 3. X-Ray Tracing

**Enabled on:**
- API Gateway: `tracingEnabled: true`
- All Lambda functions: `tracing: lambda.Tracing.ACTIVE`

**Provides:**
- End-to-end request visualization
- Service map showing dependencies
- Latency breakdown by service
- Error and fault detection

### 4. Monitoring Lambda Function

Located at: `services/monitoring/index.js`

**Endpoints:**

#### GET /monitoring/metrics
Returns CloudWatch metrics for the last 1 hour:
```json
{
  "api": {
    "requestCount": { "label": "Count", "datapoints": [...] },
    "errorRate4xx": { "label": "4XXError", "datapoints": [...] },
    "errorRate5xx": { "label": "5XXError", "datapoints": [...] },
    "latency": { "label": "Latency", "datapoints": [...] }
  },
  "lambda": {
    "HealthFunction": {
      "duration": { "label": "Duration", "datapoints": [...] },
      "errors": { "label": "Errors", "datapoints": [...] },
      "throttles": { "label": "Throttles", "datapoints": [...] }
    },
    ...
  },
  "dynamodb": {
    "readCapacity": { "label": "ConsumedReadCapacity", "datapoints": [...] },
    "writeCapacity": { "label": "ConsumedWriteCapacity", "datapoints": [...] }
  }
}
```

#### GET /monitoring/traces
Returns X-Ray trace summaries and detailed traces for the last 10 minutes:
```json
{
  "summaries": [
    {
      "Id": "1-...",
      "Duration": 0.234,
      "ResponseTime": 0.234,
      "Http": {
        "HttpURL": "https://api.example.com/items",
        "HttpStatus": 200,
        "HttpMethod": "GET"
      }
    }
  ],
  "traces": [
    {
      "Id": "1-...",
      "Duration": 0.234,
      "Segments": [...]
    }
  ]
}
```

#### GET /monitoring/alarms
Returns current state of all CloudWatch alarms:
```json
{
  "alarms": [
    {
      "AlarmName": "API-Gateway-5xx-Rate",
      "StateValue": "OK",
      "StateReason": "Threshold Crossed: 1 datapoint [0.0 (01/06/24 12:34:56)] was not greater than the threshold (1.0).",
      "StateUpdatedTimestamp": "2024-06-01T12:34:56.789Z"
    }
  ],
  "summary": {
    "ok": 5,
    "alarm": 0,
    "insufficient": 0
  }
}
```

**Authorization:**
- All endpoints require Cognito authentication
- User must be in the `Admin` group
- Returns 403 Forbidden if not admin

## Deployment

### 1. Set Alarm Email

Before deploying, configure the email address for alarm notifications:

```bash
# Option 1: Environment variable
export ALARM_EMAIL=your-email@example.com

# Option 2: CDK context
cdk deploy --all --context alarmEmail=your-email@example.com
```

### 2. Deploy Infrastructure

```bash
cd infra
npm install
cdk bootstrap  # If not already bootstrapped
cdk deploy --all
```

This will deploy:
- `SparkBoard-Auth`: Cognito User Pool with Admin group
- `SparkBoard-Storage`: DynamoDB table and S3 bucket
- `SparkBoard-API`: API Gateway, Lambda functions, monitoring endpoints
- `SparkBoard-Monitoring`: CloudWatch Dashboard, Alarms, SNS topic

### 3. Confirm SNS Subscription

After deployment:
1. Check your email for an SNS subscription confirmation
2. Click the confirmation link
3. Verify subscription is active in AWS Console

### 4. Add Admin User to Admin Group

Using AWS Console:
1. Go to Cognito User Pool
2. Select your user
3. Add to `Admin` group

Using AWS CLI:
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <USER_POOL_ID> \
  --username <USERNAME> \
  --group-name Admin
```

## Frontend Setup

### 1. Environment Variables

Update `.env.local`:
```bash
VITE_API_URL=https://your-api-gateway-url.execute-api.region.amazonaws.com
VITE_USER_POOL_ID=ap-northeast-1_xxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=sparkboard-xxxxx.auth.region.amazoncognito.com
```

### 2. Access Monitoring Dashboard

1. Log in as an admin user
2. Click "Monitoring" button in the header
3. View real-time metrics, traces, and alarms
4. Click "Refresh" to update data manually

**Features:**
- Auto-refreshes every 60 seconds
- Tabbed interface: Metrics, Traces, Alarms
- Admin role check (403 if not admin)
- Color-coded status indicators

## Testing

### 1. Test Alarm Triggers

Trigger Lambda errors to test alarms:

```bash
# Send invalid request (empty body) to items endpoint
curl -X POST https://your-api-gateway-url/items \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected result:
- Lambda function throws error
- CloudWatch Alarm transitions to ALARM state after 2 evaluation periods (10 minutes)
- SNS sends email notification

### 2. Verify X-Ray Traces

1. Make API requests to any endpoint
2. Go to AWS X-Ray Console
3. View Service Map showing API Gateway → Lambda → DynamoDB
4. Click on traces to see detailed timing breakdown

### 3. Test Monitoring Dashboard

```bash
# Get metrics (requires admin auth)
curl https://your-api-gateway-url/monitoring/metrics \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN"

# Get traces
curl https://your-api-gateway-url/monitoring/traces \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN"

# Get alarms
curl https://your-api-gateway-url/monitoring/alarms \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN"
```

## Monitoring Best Practices

### 1. Dashboard Usage

- Check dashboard daily for anomalies
- Monitor trends over time
- Set up multiple email recipients for alarms
- Review X-Ray traces for performance bottlenecks

### 2. Alarm Configuration

**Modify alarm thresholds:**

Edit `infra/lib/monitoring-stack.ts`:

```typescript
// API Gateway 5xx alarm
threshold: 1, // Change from 1% to desired threshold
evaluationPeriods: 2, // Change from 2 to desired periods

// Lambda error alarms
threshold: 0, // Change from 0 to desired threshold
evaluationPeriods: 2,
```

### 3. Cost Optimization

**Current costs (approximate):**
- CloudWatch Dashboard: $3/month
- CloudWatch Alarms: $0.10/alarm/month × 6 alarms = $0.60/month
- X-Ray Traces: $5/million traces (first 100k free)
- CloudWatch Logs: $0.50/GB ingested

**Tips:**
- Use metric filters to reduce log ingestion
- Set X-Ray sampling rate to reduce trace volume
- Delete old dashboard widgets if not needed

### 4. Security

- Monitoring endpoints require Cognito auth
- Admin group enforced via Lambda authorizer
- IAM roles follow least privilege
- No sensitive data in logs or metrics

## Troubleshooting

### Alarms not triggering

1. Check CloudWatch Logs for Lambda errors
2. Verify alarm state in CloudWatch Console
3. Ensure sufficient data points for evaluation
4. Check SNS subscription is confirmed

### X-Ray traces not appearing

1. Verify tracing is enabled on API Gateway and Lambda
2. Check IAM permissions for X-Ray
3. Wait 1-2 minutes for traces to appear
4. Use AWS X-Ray SDK for custom segments

### Monitoring dashboard shows errors

1. Check browser console for API errors
2. Verify user is in Admin group
3. Ensure VITE_API_URL is correct
4. Check CORS configuration on API Gateway

### No metrics data

1. Wait for at least 5 minutes after deployment
2. Make API requests to generate data
3. Check CloudWatch Logs for monitoring Lambda errors
4. Verify IAM permissions for CloudWatch GetMetricStatistics

## Cleanup

To remove all monitoring resources:

```bash
cd infra
cdk destroy SparkBoard-Monitoring
```

This will delete:
- CloudWatch Dashboard
- CloudWatch Alarms
- SNS Topic (including subscriptions)
- Monitoring Lambda function

X-Ray traces will be deleted automatically after 30 days.

## References

- [AWS CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [AWS X-Ray Documentation](https://docs.aws.amazon.com/xray/)
- [CloudWatch Alarms Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html)
- [X-Ray Sampling Rules](https://docs.aws.amazon.com/xray/latest/devguide/xray-console-sampling.html)
