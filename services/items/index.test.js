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
const mockDelete = jest.fn();

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
        if (command.constructor.name === 'DeleteCommand') {
          return mockDelete(command);
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
  DeleteCommand: class DeleteCommand {
    constructor(input) {
      this.input = input;
    }
  },
}));

// Helper to create mock Cognito event
function createMockEvent(httpMethod, body = null, queryStringParameters = null, pathParameters = null) {
  return {
    httpMethod,
    path: '/items',
    resource: '/items',
    body: body ? JSON.stringify(body) : null,
    queryStringParameters,
    pathParameters,
    requestContext: {
      authorizer: {
        claims: {
          sub: 'test-user-123',
          'cognito:username': 'testuser',
          username: 'testuser',
          email: 'test@example.com',
          email_verified: 'true',
          'custom:orgId': 'test-org',
          'cognito:groups': 'Admin',
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
        attachments: [{ name: 'test.pdf', size: 1024, type: 'application/pdf' }],
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.item).toBeDefined();
      expect(body.item.title).toBe('Test Task');
      expect(body.item.content).toBe('This is a test task');
      expect(body.item.type).toBe('task');
      expect(body.item.id).toBeDefined();
      expect(body.item.itemId).toBeDefined();
      expect(body.item.pk).toBeDefined();
      expect(body.item.sk).toBeDefined();
      expect(body.item.userName).toBe('testuser');
      expect(body.item.attachments).toBeDefined();
      expect(body.item.attachments).toHaveLength(1);
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

    test('should create announcement as moderator', async () => {
      mockPut.mockResolvedValue({});

      const event = createMockEvent('POST', {
        title: 'Important Announcement',
        content: 'This is an important announcement',
        type: 'announcement',
        priority: 'high',
        expiresAt: '2025-12-31T23:59:59Z',
      });
      // Change from Admin to Moderators
      event.requestContext.authorizer.claims['cognito:groups'] = 'Moderators';

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.item.type).toBe('announcement');
      expect(body.item.priority).toBe('high');
      expect(body.item.expiresAt).toBe('2025-12-31T23:59:59Z');
      expect(mockPut).toHaveBeenCalledTimes(1);
    });

    test('should reject announcement creation by regular user', async () => {
      const event = createMockEvent('POST', {
        title: 'Unauthorized Announcement',
        content: 'This should fail',
        type: 'announcement',
      });
      // Regular user (no groups)
      event.requestContext.authorizer.claims['cognito:groups'] = '';

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('moderators and admins');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should create task with subtasks and deadline', async () => {
      mockPut.mockResolvedValue({});

      const event = createMockEvent('POST', {
        title: 'Project Task',
        content: 'Complete the project',
        type: 'task',
        deadline: '2025-06-30T17:00:00Z',
        subtasks: [
          { id: 'st-1', title: 'Design mockup', completed: false },
          { id: 'st-2', title: 'Implement feature', completed: false },
        ],
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.item.type).toBe('task');
      expect(body.item.status).toBe('active');
      expect(body.item.deadline).toBe('2025-06-30T17:00:00Z');
      expect(body.item.subtasks).toHaveLength(2);
      expect(mockPut).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /items', () => {
    test('should return items with pagination', async () => {
      const mockItems = [
        {
          PK: 'ORG#test-org',
          SK: 'ITEM#item-1',
          pk: 'ORG#test-org',
          sk: 'ITEM#item-1',
          itemId: 'item-1',
          orgId: 'test-org',
          userId: 'user-1',
          username: 'user1',
          title: 'Task 1',
          content: 'Content 1',
          type: 'task',
          status: 'active',
          attachments: [],
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          PK: 'ORG#test-org',
          SK: 'ITEM#item-2',
          pk: 'ORG#test-org',
          sk: 'ITEM#item-2',
          itemId: 'item-2',
          orgId: 'test-org',
          userId: 'user-2',
          username: 'user2',
          title: 'Task 2',
          content: 'Content 2',
          type: 'announcement',
          status: 'active',
          attachments: [],
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
      expect(body.items[0].id).toBe('item-1');
      expect(body.items[0].pk).toBe('ORG#test-org');
      expect(body.items[0].sk).toBe('ITEM#item-1');
      expect(body.items[0].userName).toBe('user1');
      expect(body.items[1].title).toBe('Task 2');
      expect(body.items[1].userName).toBe('user2');
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

  describe('DELETE /items/{sk}', () => {
    test('should delete item as admin', async () => {
      mockDelete.mockResolvedValue({});

      const event = createMockEvent('DELETE', null, null, { sk: 'ITEM#item-123' });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Item deleted successfully');
      expect(body.sk).toBe('ITEM#item-123');
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    test('should delete own item as non-admin', async () => {
      // Mock user who is not admin
      const event = createMockEvent('DELETE', null, null, { sk: 'ITEM#item-123' });
      event.requestContext.authorizer.claims['cognito:groups'] = '';

      // Mock query to check ownership
      mockQuery.mockResolvedValue({
        Items: [{
          PK: 'ORG#test-org',
          SK: 'ITEM#item-123',
          userId: 'test-user-123', // Same as claims.sub
        }],
      });

      mockDelete.mockResolvedValue({});

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    test('should reject delete of other user item as non-admin', async () => {
      const event = createMockEvent('DELETE', null, null, { sk: 'ITEM#item-123' });
      event.requestContext.authorizer.claims['cognito:groups'] = '';

      mockQuery.mockResolvedValue({
        Items: [{
          PK: 'ORG#test-org',
          SK: 'ITEM#item-123',
          userId: 'other-user-456', // Different user
        }],
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(body.error).toBe('Forbidden');
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    test('should reject delete without sk parameter', async () => {
      const event = createMockEvent('DELETE');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('BadRequest');
      expect(body.message).toContain('Item SK is required');
      expect(mockDelete).not.toHaveBeenCalled();
    });

    test('should reject delete without authorization', async () => {
      const event = createMockEvent('DELETE', null, null, { sk: 'ITEM#item-123' });
      delete event.requestContext.authorizer;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('Unsupported methods', () => {
    test('should reject unsupported HTTP methods', async () => {
      const event = createMockEvent('PATCH');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(405);
      expect(body.error).toBe('MethodNotAllowed');
    });
  });
});
