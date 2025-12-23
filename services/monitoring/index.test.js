/**
 * Unit tests for monitoring handler
 * Run with: npm test
 */

// Mock AWS SDK BEFORE requiring the handler
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetMetricStatisticsCommand: jest.fn().mockImplementation((input) => ({ input, name: 'GetMetricStatisticsCommand' })),
  DescribeAlarmsCommand: jest.fn().mockImplementation((input) => ({ input, name: 'DescribeAlarmsCommand' })),
}));

jest.mock('@aws-sdk/client-xray', () => ({
  XRayClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetTraceSummariesCommand: jest.fn().mockImplementation((input) => ({ input, name: 'GetTraceSummariesCommand' })),
  BatchGetTracesCommand: jest.fn().mockImplementation((input) => ({ input, name: 'BatchGetTracesCommand' })),
}));

process.env.TABLE_NAME = 'SparkTable-Test';
process.env.NODE_ENV = 'test';

const { handler } = require('./index');

function createMockEvent(httpMethod, queryParams = null, isAdmin = true) {
  return {
    httpMethod,
    path: '/monitoring/metrics',
    resource: '/monitoring/metrics',
    queryStringParameters: queryParams,
    requestContext: {
      authorizer: {
        claims: {
          sub: 'admin-user-123',
          'cognito:username': 'admin',
          'custom:orgId': 'test-org',
          'cognito:groups': isAdmin ? 'Admin' : 'Users',
        },
      },
    },
  };
}

describe('Monitoring Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock responses for AWS SDK send calls
    mockSend.mockImplementation((command) => {
      if (command.name === 'GetMetricStatisticsCommand') {
        return Promise.resolve({
          Label: 'Test Metric',
          Datapoints: [
            { Timestamp: new Date(), Sum: 100, Average: 50 },
          ],
        });
      }
      if (command.name === 'DescribeAlarmsCommand') {
        return Promise.resolve({
          MetricAlarms: [],
        });
      }
      if (command.name === 'GetTraceSummariesCommand') {
        return Promise.resolve({
          TraceSummaries: [],
        });
      }
      return Promise.resolve({});
    });
  });

  describe('GET /monitoring/metrics', () => {
    test('should return metrics for admin', async () => {
      const event = createMockEvent('GET');
      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.api).toBeDefined();
      expect(body.lambda).toBeDefined();
      expect(body.period).toBeDefined();
      expect(mockSend).toHaveBeenCalled();
    });

    test('should reject non-admin user', async () => {
      const event = createMockEvent('GET', null, false);

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(body.error).toBeDefined();
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should reject unauthorized request', async () => {
      const event = createMockEvent('GET');
      delete event.requestContext.authorizer;

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should handle time range query', async () => {
      const event = createMockEvent('GET', {
        hours: '48',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });

    test('should handle CloudWatch errors', async () => {
      mockSend.mockRejectedValue(new Error('CloudWatch error'));

      const event = createMockEvent('GET');
      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(body.error).toBeDefined();
    });
  });

  describe('OPTIONS /monitoring/metrics', () => {
    test('should handle CORS preflight', async () => {
      const event = createMockEvent('OPTIONS');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.message).toBe('OK');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
