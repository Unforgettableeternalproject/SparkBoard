/**
 * Unit tests for health check handler
 * Run with: npm test
 */

const { handler } = require('./index');

describe('Health Lambda Handler', () => {
  test('should return 200 with healthy status', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/health',
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeDefined();
    expect(body.service).toBe('SparkBoard API');
    expect(body.version).toBeDefined();
  });

  test('should have correct CORS headers', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/health',
    };

    const response = await handler(event);

    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Content-Type']).toBe('application/json');
  });

  test('should handle OPTIONS preflight', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      path: '/health',
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Content-Type']).toBe('application/json');
  });

  test('should return consistent timestamp format', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/health',
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    // Should be ISO 8601 format
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('should be callable without authentication', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/health',
      requestContext: {}, // No authorizer
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('healthy');
  });
});
