/**
 * Unit tests for auth handlers
 * Run with: npm test
 */

const { handler } = require('./index');

// Mock environment variables
process.env.TABLE_NAME = 'SparkTable-Test';
process.env.USER_POOL_ID = 'ap-northeast-1_test123';
process.env.NODE_ENV = 'test';

// Mock AWS SDK
const mockGet = jest.fn();
const mockPut = jest.fn();
const mockUpdateUserAttributes = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn((command) => {
        if (command.constructor.name === 'GetCommand') {
          return mockGet(command);
        }
        if (command.constructor.name === 'PutCommand') {
          return mockPut(command);
        }
      }),
    })),
  },
  GetCommand: class GetCommand {
    constructor(input) {
      this.input = input;
    }
  },
  PutCommand: class PutCommand {
    constructor(input) {
      this.input = input;
    }
  },
}));

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({
    send: jest.fn((command) => {
      if (command.constructor.name === 'AdminUpdateUserAttributesCommand') {
        return mockUpdateUserAttributes(command);
      }
    }),
  })),
  AdminUpdateUserAttributesCommand: class AdminUpdateUserAttributesCommand {
    constructor(input) {
      this.input = input;
    }
  },
}));

// Helper to create mock Cognito event
function createMockEvent(httpMethod, body = null) {
  return {
    httpMethod,
    path: '/auth/me',
    resource: '/auth/me',
    body: body ? JSON.stringify(body) : null,
    requestContext: {
      authorizer: {
        claims: {
          sub: 'test-user-123',
          'cognito:username': 'testuser',
          username: 'testuser',
          email: 'test@example.com',
          email_verified: 'true',
          name: 'Test User',
          'custom:orgId': 'sparkboard-demo',
          'cognito:groups': 'Users',
        },
      },
    },
  };
}

describe('Auth Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /auth/me', () => {
    test('should return user profile with DynamoDB data', async () => {
      mockGet.mockResolvedValue({
        Item: {
          PK: 'ORG#sparkboard-demo',
          SK: 'USER#test-user-123',
          userId: 'test-user-123',
          orgId: 'sparkboard-demo',
          bio: 'Test bio',
          avatarUrl: 'https://example.com/avatar.jpg',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        },
      });

      const event = createMockEvent('GET');
      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.name).toBe('Test User');
      expect(body.user.bio).toBe('Test bio');
      expect(body.user.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(body.timestamp).toBeDefined();
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Verify ConsistentRead is true
      const getCall = mockGet.mock.calls[0][0];
      expect(getCall.input.ConsistentRead).toBe(true);
    });

    test('should return user profile without DynamoDB data', async () => {
      mockGet.mockResolvedValue({
        Item: null,
      });

      const event = createMockEvent('GET');
      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.bio).toBeUndefined();
      expect(body.user.avatarUrl).toBeUndefined();
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    test('should reject request without authorization', async () => {
      const event = createMockEvent('GET');
      delete event.requestContext.authorizer;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /auth/me', () => {
    test('should update bio and avatarUrl', async () => {
      mockPut.mockResolvedValue({});
      mockGet.mockResolvedValue({ Item: null });

      const event = createMockEvent('PATCH', {
        bio: 'Updated bio',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.user.bio).toBe('Updated bio');
      expect(body.user.avatarUrl).toBe('https://example.com/new-avatar.jpg');
      expect(mockPut).toHaveBeenCalledTimes(1);

      const putCall = mockPut.mock.calls[0][0];
      expect(putCall.input.Item.bio).toBe('Updated bio');
      expect(putCall.input.Item.avatarUrl).toBe('https://example.com/new-avatar.jpg');
    });

    test('should update name and sync to Cognito', async () => {
      mockPut.mockResolvedValue({});
      mockGet.mockResolvedValue({ Item: null });
      mockUpdateUserAttributes.mockResolvedValue({});

      const event = createMockEvent('PATCH', {
        name: 'Updated Name',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.user.name).toBe('Updated Name');
      expect(mockPut).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserAttributes).toHaveBeenCalledTimes(1);

      const cognitoCall = mockUpdateUserAttributes.mock.calls[0][0];
      expect(cognitoCall.input.UserAttributes).toContainEqual({
        Name: 'name',
        Value: 'Updated Name',
      });
    });

    test('should update email and require verification', async () => {
      mockPut.mockResolvedValue({});
      mockGet.mockResolvedValue({ Item: null });
      mockUpdateUserAttributes.mockResolvedValue({});

      const event = createMockEvent('PATCH', {
        email: 'newemail@example.com',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.warning).toBeDefined();
      expect(body.warning).toContain('verification');
      expect(mockUpdateUserAttributes).toHaveBeenCalledTimes(1);

      const cognitoCall = mockUpdateUserAttributes.mock.calls[0][0];
      expect(cognitoCall.input.UserAttributes).toContainEqual({
        Name: 'email',
        Value: 'newemail@example.com',
      });
      expect(cognitoCall.input.UserAttributes).toContainEqual({
        Name: 'email_verified',
        Value: 'false',
      });
    });

    test('should reject bio longer than 500 characters', async () => {
      const longBio = 'a'.repeat(501);
      const event = createMockEvent('PATCH', {
        bio: longBio,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('less than 500 characters');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should reject invalid avatarUrl', async () => {
      const event = createMockEvent('PATCH', {
        avatarUrl: 'not-a-valid-url',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('valid URL');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should reject invalid email format', async () => {
      const event = createMockEvent('PATCH', {
        email: 'invalid-email',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('valid email');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should reject empty name', async () => {
      const event = createMockEvent('PATCH', {
        name: '   ',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('non-empty string');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should reject request with no valid fields', async () => {
      const event = createMockEvent('PATCH', {
        invalidField: 'value',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('No valid fields');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should reject request without authorization', async () => {
      const event = createMockEvent('PATCH', { bio: 'New bio' });
      delete event.requestContext.authorizer;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
      expect(mockPut).not.toHaveBeenCalled();
    });

    test('should reject invalid JSON', async () => {
      const event = createMockEvent('PATCH');
      event.body = '{invalid json}';

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('BadRequest');
      expect(body.message).toContain('Invalid JSON');
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('OPTIONS /auth/me', () => {
    test('should handle CORS preflight', async () => {
      const event = createMockEvent('OPTIONS');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.message).toBe('OK');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(response.headers['Access-Control-Allow-Methods']).toContain('PATCH');
    });
  });

  describe('Unsupported methods', () => {
    test('should reject unsupported HTTP methods', async () => {
      const event = createMockEvent('POST');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(405);
      expect(body.error).toBe('MethodNotAllowed');
    });
  });

  describe('Error handling', () => {
    test('should handle DynamoDB errors gracefully', async () => {
      mockGet.mockRejectedValue(new Error('DynamoDB error'));

      const event = createMockEvent('GET');
      const response = await handler(event);

      // Should still return 200 as profile fetch is optional
      expect(response.statusCode).toBe(200);
    });

    test('should handle Cognito update errors', async () => {
      mockPut.mockResolvedValue({});
      mockGet.mockResolvedValue({ Item: null });
      mockUpdateUserAttributes.mockRejectedValue(new Error('Cognito error'));

      const event = createMockEvent('PATCH', {
        name: 'New Name',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(body.error).toBe('InternalServerError');
      expect(body.message).toContain('Cognito');
    });
  });
});
