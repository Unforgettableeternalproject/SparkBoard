/**
 * Monitoring Lambda Handler
 * GET /monitoring/metrics - Get CloudWatch metrics
 * GET /monitoring/traces - Get X-Ray traces
 * GET /monitoring/alarms - Get CloudWatch alarms
 * Requires Cognito JWT token with admin role
 */

const {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  DescribeAlarmsCommand,
} = require('@aws-sdk/client-cloudwatch');
const {
  XRayClient,
  GetTraceSummariesCommand,
  BatchGetTracesCommand,
} = require('@aws-sdk/client-xray');

// Initialize AWS SDK clients
const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });
const xray = new XRayClient({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.TABLE_NAME;
const API_ID = process.env.API_ID;

/**
 * Create HTTP response
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Check if user has admin role
 */
function isAdmin(event) {
  const groups =
    event.requestContext?.authorizer?.claims?.['cognito:groups'] ||
    '';
  
  return groups.includes('Admin') || groups.includes('admin');
}

/**
 * Get CloudWatch metrics
 */
async function getMetrics(event) {
  console.log('Fetching CloudWatch metrics...');

  const hours = parseInt(event.queryStringParameters?.hours || '24', 10);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

  const period = hours <= 3 ? 300 : hours <= 24 ? 3600 : 86400; // 5min, 1hr, or 1day

  try {
    // API Gateway metrics
    const apiMetrics = await Promise.all([
      // Request count
      cloudwatch.send(
        new GetMetricStatisticsCommand({
          Namespace: 'AWS/ApiGateway',
          MetricName: 'Count',
          Dimensions: [{ Name: 'ApiName', Value: 'SparkBoard API' }],
          StartTime: startTime,
          EndTime: endTime,
          Period: period,
          Statistics: ['Sum'],
        })
      ),
      // 4xx errors
      cloudwatch.send(
        new GetMetricStatisticsCommand({
          Namespace: 'AWS/ApiGateway',
          MetricName: '4XXError',
          Dimensions: [{ Name: 'ApiName', Value: 'SparkBoard API' }],
          StartTime: startTime,
          EndTime: endTime,
          Period: period,
          Statistics: ['Sum'],
        })
      ),
      // 5xx errors
      cloudwatch.send(
        new GetMetricStatisticsCommand({
          Namespace: 'AWS/ApiGateway',
          MetricName: '5XXError',
          Dimensions: [{ Name: 'ApiName', Value: 'SparkBoard API' }],
          StartTime: startTime,
          EndTime: endTime,
          Period: period,
          Statistics: ['Sum'],
        })
      ),
      // Latency
      cloudwatch.send(
        new GetMetricStatisticsCommand({
          Namespace: 'AWS/ApiGateway',
          MetricName: 'Latency',
          Dimensions: [{ Name: 'ApiName', Value: 'SparkBoard API' }],
          StartTime: startTime,
          EndTime: endTime,
          Period: period,
          Statistics: ['Average', 'Maximum'],
        })
      ),
    ]);

    // Lambda metrics for each function
    const lambdaFunctions = [
      'SparkBoard-Health',
      'SparkBoard-AuthMe',
      'SparkBoard-Items',
      'SparkBoard-Uploads',
    ];

    const lambdaMetrics = await Promise.all(
      lambdaFunctions.map(async (functionName) => {
        const [duration, errors, throttles] = await Promise.all([
          cloudwatch.send(
            new GetMetricStatisticsCommand({
              Namespace: 'AWS/Lambda',
              MetricName: 'Duration',
              Dimensions: [{ Name: 'FunctionName', Value: functionName }],
              StartTime: startTime,
              EndTime: endTime,
              Period: period,
              Statistics: ['Average', 'Maximum'],
            })
          ),
          cloudwatch.send(
            new GetMetricStatisticsCommand({
              Namespace: 'AWS/Lambda',
              MetricName: 'Errors',
              Dimensions: [{ Name: 'FunctionName', Value: functionName }],
              StartTime: startTime,
              EndTime: endTime,
              Period: period,
              Statistics: ['Sum'],
            })
          ),
          cloudwatch.send(
            new GetMetricStatisticsCommand({
              Namespace: 'AWS/Lambda',
              MetricName: 'Throttles',
              Dimensions: [{ Name: 'FunctionName', Value: functionName }],
              StartTime: startTime,
              EndTime: endTime,
              Period: period,
              Statistics: ['Sum'],
            })
          ),
        ]);

        return {
          functionName,
          duration: duration.Datapoints || [],
          errors: errors.Datapoints || [],
          throttles: throttles.Datapoints || [],
        };
      })
    );

    // DynamoDB metrics
    const dynamoMetrics = await Promise.all([
      cloudwatch.send(
        new GetMetricStatisticsCommand({
          Namespace: 'AWS/DynamoDB',
          MetricName: 'ConsumedReadCapacityUnits',
          Dimensions: [{ Name: 'TableName', Value: TABLE_NAME }],
          StartTime: startTime,
          EndTime: endTime,
          Period: period,
          Statistics: ['Sum'],
        })
      ),
      cloudwatch.send(
        new GetMetricStatisticsCommand({
          Namespace: 'AWS/DynamoDB',
          MetricName: 'ConsumedWriteCapacityUnits',
          Dimensions: [{ Name: 'TableName', Value: TABLE_NAME }],
          StartTime: startTime,
          EndTime: endTime,
          Period: period,
          Statistics: ['Sum'],
        })
      ),
    ]);

    return createResponse(200, {
      success: true,
      period: `${hours} hours`,
      api: {
        requests: apiMetrics[0].Datapoints || [],
        errors4xx: apiMetrics[1].Datapoints || [],
        errors5xx: apiMetrics[2].Datapoints || [],
        latency: apiMetrics[3].Datapoints || [],
      },
      lambda: lambdaMetrics,
      dynamodb: {
        readCapacity: dynamoMetrics[0].Datapoints || [],
        writeCapacity: dynamoMetrics[1].Datapoints || [],
      },
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to fetch metrics',
      details: error.message,
    });
  }
}

/**
 * Get X-Ray traces
 */
async function getTraces(event) {
  console.log('Fetching X-Ray traces...');

  const hours = parseInt(event.queryStringParameters?.hours || '1', 10);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

  try {
    // Get trace summaries
    const summariesResponse = await xray.send(
      new GetTraceSummariesCommand({
        StartTime: startTime,
        EndTime: endTime,
        Sampling: true,
        SamplingStrategy: {
          Name: 'PartialScan',
          Value: 0.1, // Sample 10% of traces
        },
      })
    );

    const traceSummaries = summariesResponse.TraceSummaries || [];

    // Get detailed traces for the first 10
    const traceIds = traceSummaries.slice(0, 10).map((t) => t.Id);

    let traces = [];
    if (traceIds.length > 0) {
      const tracesResponse = await xray.send(
        new BatchGetTracesCommand({
          TraceIds: traceIds,
        })
      );

      traces = tracesResponse.Traces || [];
    }

    return createResponse(200, {
      success: true,
      period: `${hours} hours`,
      summaries: traceSummaries.map((summary) => ({
        id: summary.Id,
        duration: summary.Duration,
        responseTime: summary.ResponseTime,
        hasError: summary.HasError || false,
        hasFault: summary.HasFault || false,
        hasThrottle: summary.HasThrottle || false,
        http: summary.Http,
        users: summary.Users,
        serviceIds: summary.ServiceIds,
      })),
      traces: traces.map((trace) => ({
        id: trace.Id,
        duration: trace.Duration,
        segments: trace.Segments?.map((seg) => {
          try {
            return JSON.parse(seg.Document);
          } catch {
            return seg.Document;
          }
        }),
      })),
    });
  } catch (error) {
    console.error('Error fetching traces:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to fetch traces',
      details: error.message,
    });
  }
}

/**
 * Get CloudWatch alarms
 */
async function getAlarms(event) {
  console.log('Fetching CloudWatch alarms...');

  try {
    const response = await cloudwatch.send(
      new DescribeAlarmsCommand({
        AlarmNamePrefix: 'SparkBoard-',
        MaxRecords: 100,
      })
    );

    const alarms = (response.MetricAlarms || []).map((alarm) => ({
      name: alarm.AlarmName,
      description: alarm.AlarmDescription,
      state: alarm.StateValue,
      stateReason: alarm.StateReason,
      stateUpdatedTimestamp: alarm.StateUpdatedTimestamp,
      metricName: alarm.MetricName,
      namespace: alarm.Namespace,
      threshold: alarm.Threshold,
      comparisonOperator: alarm.ComparisonOperator,
      evaluationPeriods: alarm.EvaluationPeriods,
      datapointsToAlarm: alarm.DatapointsToAlarm,
    }));

    return createResponse(200, {
      success: true,
      alarms,
      summary: {
        total: alarms.length,
        ok: alarms.filter((a) => a.state === 'OK').length,
        alarm: alarms.filter((a) => a.state === 'ALARM').length,
        insufficient: alarms.filter((a) => a.state === 'INSUFFICIENT_DATA')
          .length,
      },
    });
  } catch (error) {
    console.error('Error fetching alarms:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to fetch alarms',
      details: error.message,
    });
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Monitoring handler invoked:', {
    httpMethod: event.httpMethod,
    path: event.path,
    resource: event.resource,
  });

  // Check admin role
  if (!isAdmin(event)) {
    return createResponse(403, {
      error: 'Forbidden',
      message: 'Admin role required to access monitoring endpoints',
    });
  }

  // Handle different routes
  if (event.resource === '/monitoring/metrics' && event.httpMethod === 'GET') {
    return await getMetrics(event);
  }

  if (event.resource === '/monitoring/traces' && event.httpMethod === 'GET') {
    return await getTraces(event);
  }

  if (event.resource === '/monitoring/alarms' && event.httpMethod === 'GET') {
    return await getAlarms(event);
  }

  // OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, { message: 'OK' });
  }

  return createResponse(404, {
    error: 'NotFound',
    message: 'Endpoint not found',
  });
};
