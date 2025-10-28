/**
 * Unit tests for items handlers
 * Run with: npm test
 */

const { handler } = require('./index');

// Mock environment variables
process.env.TABLE_NAME = 'SparkTable-Test';
process.env.NODE_ENV = 'test';

// Mock AWS SDK
const mockPut = jest.fn();
const mockQuery = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command.constructor.name === 'PutCommand') {
          return mockPut(command);
        }
        if (command.constructor.name === 'QueryCommand') {
          return mockQuery(command);
        }
      }),
    })),
  },
  PutCommand: class PutCommand {
    constructor(input) {
      this.input = input;
    }
  },
  QueryCommand: class QueryCommand {
    constructor(input) {
      this.input = input;
    }
  },
}));

// Helper to create mock Cognito event
function createMockEvent(httpMethod, body = null, queryStringParameters = null) {
  return {
    httpMethod,
    path: '/items',
    resource: '/items',
    body: body ? JSON.stringify(body) : null,
    queryStringParameters,
    requestContext: {
      authorizer: {
        claims: {
          sub: 'test-user-123',
          'cognito:username': 'testuser',
          username: 'testuser',
          email: 'test@example.com',
          email_verified: 'true',
          'custom:orgId': 'test-org',
          auth_time: Math.floor(Date.now() / 1000),
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    },
  };
}

describe('Items Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /items', () => {
    test('should create item with valid title', async () => {
      mockPut.mockResolvedValue({});

      const event = createMockEvent('POST', {
        title: 'Test Task',
        content: 'This is a test task',
        type: 'task',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.item).toBeDefined();
      expect(body.item.title).toBe('Test Task');
      expect(body.item.content).toBe('This is a test task');
      expect(body.item.type).toBe('task');
      expect(body.item.itemId).toBeDefined();
      expect(mockPut).toHaveBeenCalledTimes(1);
    });

    test('should reject request with missing title', async () => {
      const event = createMockEvent('POST', {
        content: 'Content without title',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('Title is required');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should reject request with empty title', async () => {
      const event = createMockEvent('POST', {
        title: '   ',
        content: 'Content with empty title',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should reject request without authorization', async () => {
      const event = createMockEvent('POST', {
        title: 'Test Task',
      });
      delete event.requestContext.authorizer;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should handle DynamoDB errors gracefully', async () => {
      mockPut.mockRejectedValue(new Error('DynamoDB error'));

      const event = createMockEvent('POST', {
        title: 'Test Task',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(body.error).toBe('InternalServerError');
    });
  });

  describe('GET /items', () => {
    test('should return items with pagination', async () => {
      const mockItems = [
        {
          itemId: 'item-1',
          orgId: 'test-org',
          userId: 'user-1',
          username: 'user1',
          title: 'Task 1',
          content: 'Content 1',
          type: 'task',
          status: 'active',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          itemId: 'item-2',
          orgId: 'test-org',
          userId: 'user-2',
          username: 'user2',
          title: 'Task 2',
          content: 'Content 2',
          type: 'announcement',
          status: 'active',
          createdAt: '2025-01-02T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        },
      ];

      mockQuery.mockResolvedValue({
        Items: mockItems,
        LastEvaluatedKey: { PK: 'ORG#test-org', SK: 'ITEM#item-2' },
      });

      const event = createMockEvent('GET', null, { limit: '2' });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.items).toHaveLength(2);
      expect(body.items[0].title).toBe('Task 1');
      expect(body.items[1].title).toBe('Task 2');
      expect(body.nextToken).toBeDefined();
      expect(body.hasMore).toBe(true);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('should return empty array when no items', async () => {
      mockQuery.mockResolvedValue({
        Items: [],
      });

      const event = createMockEvent('GET');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.items).toHaveLength(0);
      expect(body.nextToken).toBeNull();
      expect(body.hasMore).toBe(false);
    });

    test('should reject invalid limit', async () => {
      const event = createMockEvent('GET', null, { limit: '200' });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('Limit must be between 1 and 100');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('should reject request without authorization', async () => {
      const event = createMockEvent('GET');
      delete event.requestContext.authorizer;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('should handle nextToken pagination', async () => {
      mockQuery.mockResolvedValue({
        Items: [
          {
            itemId: 'item-3',
            title: 'Task 3',
            createdAt: '2025-01-03T00:00:00Z',
          },
        ],
      });

      const nextToken = Buffer.from(
        JSON.stringify({ PK: 'ORG#test-org', SK: 'ITEM#item-2' })
      ).toString('base64');

      const event = createMockEvent('GET', null, {
        limit: '1',
        nextToken,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      
      const queryCall = mockQuery.mock.calls[0][0];
      expect(queryCall.input.ExclusiveStartKey).toBeDefined();
    });
  });

  describe('OPTIONS /items', () => {
    test('should handle CORS preflight', async () => {
      const event = createMockEvent('OPTIONS');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.message).toBe('OK');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('Unsupported methods', () => {
    test('should reject unsupported HTTP methods', async () => {
      const event = createMockEvent('DELETE');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(405);
      expect(body.error).toBe('MethodNotAllowed');
    });
  });
});
