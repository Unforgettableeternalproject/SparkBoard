/**
 * Health Check Lambda Handler
 * GET /health - Returns API health status
 */

exports.handler = async (event) => {
  console.log('Health check request:', JSON.stringify(event, null, 2));

  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      status: 'healthy',
      service: 'SparkBoard API',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      resources: {
        dynamodb: process.env.TABLE_NAME || 'not-configured',
        s3: process.env.BUCKET_NAME || 'not-configured',
        cognito: process.env.USER_POOL_ID || 'not-configured',
      },
    }),
  };

  return response;
};
