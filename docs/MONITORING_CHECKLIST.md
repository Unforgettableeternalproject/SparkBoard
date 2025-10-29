# Monitoring Deployment Checklist

Complete checklist for deploying the monitoring system to production.

## Pre-Deployment

- [ ] Review alarm thresholds in `infra/lib/monitoring-stack.ts`
- [ ] Set alarm email address (environment variable or CDK context)
- [ ] Review X-Ray sampling rate (default: all requests)
- [ ] Check CloudWatch Logs retention period (default: 7 days)
- [ ] Verify IAM permissions for monitoring Lambda function

## Infrastructure Deployment

- [ ] Run `cd infra && npm install`
- [ ] Run `cdk synth` to validate CloudFormation templates
- [ ] Run `cdk diff` to preview changes
- [ ] Deploy Auth Stack: `cdk deploy SparkBoard-Auth`
- [ ] Deploy Storage Stack: `cdk deploy SparkBoard-Storage`
- [ ] Deploy API Stack: `cdk deploy SparkBoard-API`
- [ ] Deploy Monitoring Stack: `cdk deploy SparkBoard-Monitoring --context alarmEmail=your@email.com`

## Post-Deployment Configuration

- [ ] Confirm SNS subscription email
- [ ] Create admin user or add existing user to Admin group
- [ ] Run `./scripts/add-admin-user.ps1 -Username <username>` (Windows)
- [ ] Or run `./scripts/add-admin-user.sh <username>` (Linux/Mac)
- [ ] Verify user group membership in Cognito Console

## Frontend Configuration

- [ ] Update `.env.local` with API URL and Cognito details
- [ ] Run `npm install` to ensure all dependencies are installed
- [ ] Run `npm run dev` to start development server
- [ ] Log in with admin user
- [ ] Verify "Admin" badge appears in header
- [ ] Verify "Monitoring" navigation button is visible

## Validation

### Test Monitoring Dashboard Access

- [ ] Navigate to Monitoring page
- [ ] Verify metrics are displayed (may take 5-10 minutes for first data)
- [ ] Check API Gateway metrics: request count, error rates, latency
- [ ] Check Lambda metrics: duration, errors, throttles
- [ ] Check DynamoDB metrics: read/write capacity
- [ ] Verify auto-refresh works (60 second interval)

### Test X-Ray Tracing

- [ ] Make API requests (GET /items, POST /items, etc.)
- [ ] Go to AWS X-Ray Console
- [ ] Verify traces appear within 1-2 minutes
- [ ] Check Service Map shows: API Gateway → Lambda → DynamoDB
- [ ] Click on trace to see detailed timing breakdown
- [ ] Verify no errors or faults in traces

### Test CloudWatch Alarms

#### API Gateway 5xx Rate Alarm

- [ ] Intentionally break Lambda function (deploy with syntax error)
- [ ] Make 10+ API requests to trigger 5xx errors
- [ ] Wait 10 minutes for alarm evaluation
- [ ] Verify alarm transitions to ALARM state
- [ ] Check email for SNS notification
- [ ] Fix Lambda function
- [ ] Verify alarm returns to OK state

#### Lambda Error Alarm

- [ ] Send invalid request body: `curl -X POST <api-url>/items -H "Authorization: Bearer $TOKEN" -d '{}'`
- [ ] Repeat 5+ times to ensure consistent errors
- [ ] Wait 10 minutes for alarm evaluation
- [ ] Verify alarm transitions to ALARM state
- [ ] Check email for SNS notification
- [ ] Verify alarm returns to OK after valid requests

### Test RBAC

- [ ] Create non-admin test user
- [ ] Log in as non-admin user
- [ ] Verify "Monitoring" button is NOT visible
- [ ] Try accessing `/monitoring/metrics` endpoint directly
- [ ] Verify 403 Forbidden response
- [ ] Log in as admin user
- [ ] Verify "Monitoring" button IS visible
- [ ] Verify all monitoring endpoints return 200 OK

## Monitoring Operations

### Daily Checks

- [ ] Review CloudWatch Dashboard for anomalies
- [ ] Check alarm status (all should be OK)
- [ ] Review X-Ray Service Map for new dependencies
- [ ] Check Lambda error logs for recurring issues

### Weekly Checks

- [ ] Review CloudWatch costs in AWS Billing
- [ ] Analyze API latency trends
- [ ] Review Lambda cold start metrics
- [ ] Check DynamoDB throttling events

### Monthly Checks

- [ ] Review and adjust alarm thresholds if needed
- [ ] Archive old CloudWatch Dashboard if needed
- [ ] Review X-Ray sampling rate and adjust for cost
- [ ] Update monitoring documentation

## Rollback Plan

If monitoring deployment fails:

1. Check CloudFormation stack events for errors
2. Roll back monitoring stack:
   ```bash
   cdk destroy SparkBoard-Monitoring
   ```
3. Roll back API stack if Lambda permissions cause issues:
   ```bash
   cdk destroy SparkBoard-API
   ```
4. Review CloudFormation error messages
5. Fix infrastructure code
6. Re-deploy

## Troubleshooting

### Issue: No metrics data in dashboard

**Symptoms:** Dashboard shows "N/A" for all metrics

**Solution:**
1. Wait 5-10 minutes after first deployment
2. Make API requests to generate data
3. Check CloudWatch Logs for monitoring Lambda errors
4. Verify IAM permissions for CloudWatch GetMetricStatistics
5. Check API Gateway CloudWatch metrics are enabled

### Issue: X-Ray traces not appearing

**Symptoms:** No traces in AWS X-Ray Console

**Solution:**
1. Verify `tracing: lambda.Tracing.ACTIVE` on all Lambda functions
2. Check `tracingEnabled: true` on API Gateway
3. Wait 1-2 minutes for traces to propagate
4. Verify IAM permissions for X-Ray PutTraceSegments
5. Check Lambda execution role has X-Ray write permissions

### Issue: Alarms not triggering

**Symptoms:** No email notifications despite errors

**Solution:**
1. Verify SNS subscription is confirmed
2. Check alarm state in CloudWatch Console
3. Ensure sufficient data points for evaluation (need 2 consecutive periods)
4. Review alarm configuration and thresholds
5. Test SNS topic manually with AWS CLI

### Issue: 403 Forbidden on monitoring endpoints

**Symptoms:** Admin user gets 403 error

**Solution:**
1. Verify user is in Admin group (run add-admin-user script again)
2. User must log out and log in for group changes to take effect
3. Check ID token includes `cognito:groups` claim
4. Verify monitoring Lambda checks correct group name ("Admin")
5. Check CloudWatch Logs for monitoring Lambda authorization logs

### Issue: High CloudWatch costs

**Symptoms:** Unexpectedly high AWS bill

**Solution:**
1. Review CloudWatch Logs ingestion volume
2. Set up metric filters to reduce log verbosity
3. Adjust X-Ray sampling rate (default is 100%)
4. Delete unused dashboard widgets
5. Set log retention to 7 days instead of indefinite

## Success Criteria

- [ ] All CloudFormation stacks deployed successfully
- [ ] Admin user can access monitoring dashboard
- [ ] Non-admin users cannot access monitoring endpoints
- [ ] Metrics display current API, Lambda, and DynamoDB data
- [ ] X-Ray traces show complete request paths
- [ ] Alarms trigger correctly and send email notifications
- [ ] Dashboard auto-refreshes every 60 seconds
- [ ] No errors in CloudWatch Logs for monitoring Lambda
- [ ] CloudWatch Dashboard accessible in AWS Console
- [ ] All costs within expected budget (<$10/month)

## Next Steps

After successful deployment:

1. Set up additional alarms for custom metrics
2. Create custom X-Ray segments for business logic
3. Add metric filters for application-specific errors
4. Set up CloudWatch Insights queries for log analysis
5. Create runbooks for common alert scenarios
6. Schedule weekly monitoring review meetings
7. Document standard operating procedures
8. Train team on monitoring tools and dashboards

## Documentation Updates

After deployment, update:

- [ ] `.env.example` with new environment variables
- [ ] README.md with monitoring section
- [ ] API documentation with monitoring endpoints
- [ ] Architecture diagram with monitoring components
- [ ] Team wiki with monitoring procedures
- [ ] On-call runbooks with alarm response procedures

---

**Deployment Date:** _______________

**Deployed By:** _______________

**Verified By:** _______________

**Sign-off:** _______________
