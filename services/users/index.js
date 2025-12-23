/**
 * Users Lambda Handler - Admin only
 * GET /users - List all users
 * POST /users/add-to-group - Add user to group
 * POST /users/remove-from-group - Remove user from group
 */

const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
  AdminUserGlobalSignOutCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID;

/**
 * Helper function to create API response
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Extract user info from Cognito authorizer
 */
function getUserFromEvent(event) {
  const authorizer = event.requestContext?.authorizer;
  if (!authorizer || !authorizer.claims) {
    return null;
  }

  const claims = authorizer.claims;
  const groups = claims['cognito:groups'] ? claims['cognito:groups'].split(',') : [];

  return {
    userId: claims.sub,
    username: claims['cognito:username'] || claims.username,
    email: claims.email,
    groups,
    isAdmin: groups.includes('Admin'),
  };
}

/**
 * Check if user has admin permission
 */
function checkAdminPermission(event) {
  const user = getUserFromEvent(event);
  return user && user.isAdmin;
}

/**
 * GET /users - List all users with their groups
 */
async function listUsers(event) {
  console.log('Listing users:', JSON.stringify(event, null, 2));

  try {
    const user = getUserFromEvent(event);
    if (!user) {
      return createResponse(401, {
        error: 'Unauthorized',
        message: 'No valid authorization token provided',
      });
    }

    // Check if user is admin
    if (!user.isAdmin) {
      return createResponse(403, {
        error: 'Forbidden',
        message: 'Only administrators can list users',
      });
    }

    // List all users
    const listUsersCommand = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
    });

    const listUsersResponse = await cognitoClient.send(listUsersCommand);

    // Get groups for each user
    const usersWithGroups = await Promise.all(
      (listUsersResponse.Users || []).map(async (cognitoUser) => {
        try {
          const listGroupsCommand = new AdminListGroupsForUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: cognitoUser.Username,
          });

          const groupsResponse = await cognitoClient.send(listGroupsCommand);
          const groups = (groupsResponse.Groups || []).map((g) => g.GroupName);

          return {
            ...cognitoUser,
            Groups: groups,
          };
        } catch (error) {
          console.error(`Error getting groups for user ${cognitoUser.Username}:`, error);
          return {
            ...cognitoUser,
            Groups: [],
          };
        }
      })
    );

    console.log(`Found ${usersWithGroups.length} users`);

    return createResponse(200, {
      users: usersWithGroups,
      count: usersWithGroups.length,
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to list users',
      details: error.message,
    });
  }
}

/**
 * POST /users/add-to-group - Add user to group
 */
async function addUserToGroup(event) {
  console.log('Adding user to group:', JSON.stringify(event, null, 2));

  try {
    const user = getUserFromEvent(event);
    if (!user) {
      return createResponse(401, {
        error: 'Unauthorized',
        message: 'No valid authorization token provided',
      });
    }

    // Check if user is admin
    if (!user.isAdmin) {
      return createResponse(403, {
        error: 'Forbidden',
        message: 'Only administrators can manage user groups',
      });
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { username, groupName } = body;

    if (!username || !groupName) {
      return createResponse(400, {
        error: 'BadRequest',
        message: 'Username and groupName are required',
      });
    }

    // Add user to group
    const command = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      GroupName: groupName,
    });

    await cognitoClient.send(command);

    console.log(`Added user ${username} to group ${groupName}`);

    return createResponse(200, {
      success: true,
      message: `User ${username} added to group ${groupName}`,
    });
  } catch (error) {
    console.error('Error adding user to group:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to add user to group',
      details: error.message,
    });
  }
}

/**
 * POST /users/remove-from-group - Remove user from group
 */
async function removeUserFromGroup(event) {
  console.log('Removing user from group:', JSON.stringify(event, null, 2));

  try {
    const user = getUserFromEvent(event);
    if (!user) {
      return createResponse(401, {
        error: 'Unauthorized',
        message: 'No valid authorization token provided',
      });
    }

    // Check if user is admin
    if (!user.isAdmin) {
      return createResponse(403, {
        error: 'Forbidden',
        message: 'Only administrators can manage user groups',
      });
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { username, groupName } = body;

    if (!username || !groupName) {
      return createResponse(400, {
        error: 'BadRequest',
        message: 'Username and groupName are required',
      });
    }

    // Remove user from group
    const command = new AdminRemoveUserFromGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      GroupName: groupName,
    });

    await cognitoClient.send(command);

    console.log(`Removed user ${username} from group ${groupName}`);

    return createResponse(200, {
      success: true,
      message: `User ${username} removed from group ${groupName}`,
    });
  } catch (error) {
    console.error('Error removing user from group:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to remove user from group',
      details: error.message,
    });
  }
}

/**
 * Disable user
 * POST /users/disable
 * Body: { username: string }
 */
async function disableUser(event) {
  console.log('disableUser invoked');

  // Check admin permission
  const hasPermission = checkAdminPermission(event);
  if (!hasPermission) {
    return createResponse(403, {
      error: 'Forbidden',
      message: 'Only administrators can disable users',
    });
  }

  const body = JSON.parse(event.body || '{}');
  const { username } = body;

  if (!username) {
    return createResponse(400, {
      error: 'ValidationError',
      message: 'Username is required',
    });
  }

  try {
    // Check if target user is an admin
    const listGroupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });
    
    const groupsResponse = await cognitoClient.send(listGroupsCommand);
    const userGroups = (groupsResponse.Groups || []).map((g) => g.GroupName);
    
    if (userGroups.includes('Admin')) {
      return createResponse(403, {
        error: 'Forbidden',
        message: 'Cannot disable administrator users',
      });
    }

    const command = new AdminDisableUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    await cognitoClient.send(command);

    // Sign out all user sessions by calling AdminUserGlobalSignOut
    const { AdminUserGlobalSignOutCommand } = require('@aws-sdk/client-cognito-identity-provider');
    try {
      const signOutCommand = new AdminUserGlobalSignOutCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
      });
      await cognitoClient.send(signOutCommand);
      console.log(`User ${username} signed out from all sessions`);
    } catch (signOutError) {
      console.error('Error signing out user:', signOutError);
      // Continue even if sign out fails
    }

    console.log(`User ${username} disabled successfully`);
    return createResponse(200, {
      message: 'User disabled successfully',
      username,
    });
  } catch (error) {
    console.error('Error disabling user:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to disable user',
      details: error.message,
    });
  }
}

/**
 * Enable user
 * POST /users/enable
 * Body: { username: string }
 */
async function enableUser(event) {
  console.log('enableUser invoked');

  // Check admin permission
  const hasPermission = checkAdminPermission(event);
  if (!hasPermission) {
    return createResponse(403, {
      error: 'Forbidden',
      message: 'Only administrators can enable users',
    });
  }

  const body = JSON.parse(event.body || '{}');
  const { username } = body;

  if (!username) {
    return createResponse(400, {
      error: 'ValidationError',
      message: 'Username is required',
    });
  }

  try {
    const command = new AdminEnableUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    await cognitoClient.send(command);

    console.log(`User ${username} enabled successfully`);
    return createResponse(200, {
      message: 'User enabled successfully',
      username,
    });
  } catch (error) {
    console.error('Error enabling user:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to enable user',
      details: error.message,
    });
  }
}

/**
 * Delete user (only if disabled)
 * DELETE /users
 * Body: { username: string }
 */
async function deleteUser(event) {
  console.log('deleteUser invoked');

  // Check admin permission
  const hasPermission = checkAdminPermission(event);
  if (!hasPermission) {
    return createResponse(403, {
      error: 'Forbidden',
      message: 'Only administrators can delete users',
    });
  }

  const body = JSON.parse(event.body || '{}');
  const { username } = body;

  if (!username) {
    return createResponse(400, {
      error: 'ValidationError',
      message: 'Username is required',
    });
  }

  try {
    // First, check if user is disabled
    const listCommand = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `username = "${username}"`,
    });
    const listResult = await cognitoClient.send(listCommand);
    
    if (!listResult.Users || listResult.Users.length === 0) {
      return createResponse(404, {
        error: 'NotFound',
        message: 'User not found',
      });
    }

    const user = listResult.Users[0];
    if (user.Enabled !== false) {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'User must be disabled before deletion',
      });
    }
    
    // Check if target user is an admin
    const listGroupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });
    
    const groupsResponse = await cognitoClient.send(listGroupsCommand);
    const userGroups = (groupsResponse.Groups || []).map((g) => g.GroupName);
    
    if (userGroups.includes('Admin')) {
      return createResponse(403, {
        error: 'Forbidden',
        message: 'Cannot delete administrator users',
      });
    }

    // Delete the user
    const deleteCommand = new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    await cognitoClient.send(deleteCommand);

    console.log(`User ${username} deleted successfully`);
    return createResponse(200, {
      message: 'User deleted successfully',
      username,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to delete user',
      details: error.message,
    });
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Users handler invoked:', {
    httpMethod: event.httpMethod,
    path: event.path,
    resource: event.resource,
  });

  const httpMethod = event.httpMethod;
  const resource = event.resource;

  try {
    switch (httpMethod) {
      case 'GET':
        if (resource === '/users') {
          return await listUsers(event);
        }
        break;

      case 'POST':
        if (resource === '/users/add-to-group') {
          return await addUserToGroup(event);
        } else if (resource === '/users/remove-from-group') {
          return await removeUserFromGroup(event);
        } else if (resource === '/users/disable') {
          return await disableUser(event);
        } else if (resource === '/users/enable') {
          return await enableUser(event);
        }
        break;

      case 'DELETE':
        if (resource === '/users') {
          return await deleteUser(event);
        }
        break;

      case 'OPTIONS':
        return createResponse(200, { message: 'OK' });

      default:
        return createResponse(405, {
          error: 'MethodNotAllowed',
          message: `Method ${httpMethod} not allowed`,
        });
    }

    return createResponse(404, {
      error: 'NotFound',
      message: 'Resource not found',
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
      details: error.message,
    });
  }
};
