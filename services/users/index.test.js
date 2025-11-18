/**
 * Unit tests for users handlers (Admin only)
 * Run with: npm test
 */

const { handler } = require('./index');

// Mock environment variables
process.env.USER_POOL_ID = 'ap-northeast-1_test123';
process.env.NODE_ENV = 'test';

// Mock AWS SDK
const mockListUsers = jest.fn();
const mockListGroupsForUser = jest.fn();
const mockAddUserToGroup = jest.fn();
const mockRemoveUserFromGroup = jest.fn();
const mockDisableUser = jest.fn();
const mockEnableUser = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({
    send: jest.fn((command) => {
      const name = command.constructor.name;
      if (name === 'ListUsersCommand') return mockListUsers(command);
      if (name === 'AdminListGroupsForUserCommand') return mockListGroupsForUser(command);
      if (name === 'AdminAddUserToGroupCommand') return mockAddUserToGroup(command);
      if (name === 'AdminRemoveUserFromGroupCommand') return mockRemoveUserFromGroup(command);
      if (name === 'AdminDisableUserCommand') return mockDisableUser(command);
      if (name === 'AdminEnableUserCommand') return mockEnableUser(command);
      if (name === 'AdminDeleteUserCommand') return mockDeleteUser(command);
    }),
  })),
  ListUsersCommand: class ListUsersCommand {
    constructor(input) {
      this.input = input;
    }
  },
  AdminListGroupsForUserCommand: class AdminListGroupsForUserCommand {
    constructor(input) {
      this.input = input;
    }
  },
  AdminAddUserToGroupCommand: class AdminAddUserToGroupCommand {
    constructor(input) {
      this.input = input;
    }
  },
  AdminRemoveUserFromGroupCommand: class AdminRemoveUserFromGroupCommand {
    constructor(input) {
      this.input = input;
    }
  },
  AdminDisableUserCommand: class AdminDisableUserCommand {
    constructor(input) {
      this.input = input;
    }
  },
  AdminEnableUserCommand: class AdminEnableUserCommand {
    constructor(input) {
      this.input = input;
    }
  },
  AdminDeleteUserCommand: class AdminDeleteUserCommand {
    constructor(input) {
      this.input = input;
    }
  },
}));

function createMockEvent(httpMethod, resource, body = null, isAdmin = true) {
  return {
    httpMethod,
    resource,
    path: resource,
    body: body ? JSON.stringify(body) : null,
    requestContext: {
      authorizer: {
        claims: {
          sub: 'admin-user-123',
          'cognito:username': 'admin',
          email: 'admin@example.com',
          'cognito:groups': isAdmin ? 'Admin' : 'Users',
        },
      },
    },
  };
}

describe('Users Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    test('should list all users with groups as admin', async () => {
      mockListUsers.mockResolvedValue({
        Users: [
          {
            Username: 'user1',
            Attributes: [
              { Name: 'email', Value: 'user1@example.com' },
              { Name: 'sub', Value: 'user-1-id' },
            ],
            UserStatus: 'CONFIRMED',
          },
          {
            Username: 'user2',
            Attributes: [
              { Name: 'email', Value: 'user2@example.com' },
              { Name: 'sub', Value: 'user-2-id' },
            ],
            UserStatus: 'CONFIRMED',
          },
        ],
      });

      mockListGroupsForUser
        .mockResolvedValueOnce({ Groups: [{ GroupName: 'Admin' }] })
        .mockResolvedValueOnce({ Groups: [{ GroupName: 'Users' }] });

      const event = createMockEvent('GET', '/users');
      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.users).toHaveLength(2);
      expect(body.count).toBe(2);
      expect(body.users[0].Username).toBe('user1');
      expect(body.users[0].Groups).toContain('Admin');
      expect(body.users[1].Groups).toContain('Users');
      expect(mockListUsers).toHaveBeenCalledTimes(1);
      expect(mockListGroupsForUser).toHaveBeenCalledTimes(2);
    });

    test('should reject non-admin user', async () => {
      const event = createMockEvent('GET', '/users', null, false);

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('administrators');
      expect(mockListUsers).not.toHaveBeenCalled();
    });

    test('should reject unauthorized request', async () => {
      const event = createMockEvent('GET', '/users');
      delete event.requestContext.authorizer;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
      expect(mockListUsers).not.toHaveBeenCalled();
    });
  });

  describe('POST /users/add-to-group', () => {
    test('should add user to group as admin', async () => {
      mockAddUserToGroup.mockResolvedValue({});

      const event = createMockEvent('POST', '/users/add-to-group', {
        username: 'user1',
        groupName: 'Moderators',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain('user1');
      expect(body.message).toContain('Moderators');
      expect(mockAddUserToGroup).toHaveBeenCalledTimes(1);
    });

    test('should reject request without username', async () => {
      const event = createMockEvent('POST', '/users/add-to-group', {
        groupName: 'Moderators',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('BadRequest');
      expect(body.message).toContain('required');
      expect(mockAddUserToGroup).not.toHaveBeenCalled();
    });

    test('should reject non-admin user', async () => {
      const event = createMockEvent('POST', '/users/add-to-group', {
        username: 'user1',
        groupName: 'Moderators',
      }, false);

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(body.error).toBe('Forbidden');
      expect(mockAddUserToGroup).not.toHaveBeenCalled();
    });
  });

  describe('POST /users/remove-from-group', () => {
    test('should remove user from group as admin', async () => {
      mockRemoveUserFromGroup.mockResolvedValue({});

      const event = createMockEvent('POST', '/users/remove-from-group', {
        username: 'user1',
        groupName: 'Moderators',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain('removed');
      expect(mockRemoveUserFromGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /users/disable', () => {
    test('should disable user as admin', async () => {
      // Mock ListGroupsForUser to return non-admin groups
      mockListGroupsForUser.mockResolvedValue({
        Groups: [{ GroupName: 'Users' }],
      });
      mockDisableUser.mockResolvedValue({});

      const event = createMockEvent('POST', '/users/disable', {
        username: 'user1',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.message).toContain('disabled');
      expect(body.username).toBe('user1');
      expect(mockDisableUser).toHaveBeenCalledTimes(1);
    });

    test('should reject request without username', async () => {
      const event = createMockEvent('POST', '/users/disable', {});

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(mockDisableUser).not.toHaveBeenCalled();
    });
  });

  describe('POST /users/enable', () => {
    test('should enable user as admin', async () => {
      mockEnableUser.mockResolvedValue({});

      const event = createMockEvent('POST', '/users/enable', {
        username: 'user1',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.message).toContain('enabled');
      expect(mockEnableUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /users', () => {
    test('should delete disabled user as admin', async () => {
      mockListUsers.mockResolvedValue({
        Users: [{
          Username: 'user1',
          Enabled: false,
        }],
      });
      // Mock ListGroupsForUser to return non-admin groups
      mockListGroupsForUser.mockResolvedValue({
        Groups: [{ GroupName: 'Users' }],
      });
      mockDeleteUser.mockResolvedValue({});

      const event = createMockEvent('DELETE', '/users', {
        username: 'user1',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.message).toContain('deleted');
      expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    });

    test('should reject deletion of enabled user', async () => {
      mockListUsers.mockResolvedValue({
        Users: [{
          Username: 'user1',
          Enabled: true,
        }],
      });

      const event = createMockEvent('DELETE', '/users', {
        username: 'user1',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('disabled before deletion');
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    test('should reject deletion of non-existent user', async () => {
      mockListUsers.mockResolvedValue({
        Users: [],
      });

      const event = createMockEvent('DELETE', '/users', {
        username: 'nonexistent',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(body.error).toBe('NotFound');
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });
  });

  describe('OPTIONS /users', () => {
    test('should handle CORS preflight', async () => {
      const event = createMockEvent('OPTIONS', '/users');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.message).toBe('OK');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('Error handling', () => {
    test('should handle Cognito errors gracefully', async () => {
      mockListUsers.mockRejectedValue(new Error('Cognito error'));

      const event = createMockEvent('GET', '/users');
      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(body.error).toBe('InternalServerError');
    });
  });
});
