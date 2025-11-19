/**
 * Auth Me Lambda Handler
 * GET /auth/me - Returns authenticated user information with profile
 * PATCH /auth/me - Update user profile (bio, avatar)
 * Requires Cognito JWT token in Authorization header
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

const TABLE_NAME = process.env.TABLE_NAME;

function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

function getUserFromEvent(event) {
  const authorizer = event.requestContext?.authorizer;
  if (!authorizer || !authorizer.claims) {
    return null;
  }

  const claims = authorizer.claims;
  return {
    userId: claims.sub,
    username: claims['cognito:username'] || claims.username,
    email: claims.email,
    emailVerified: claims.email_verified === 'true',
    name: claims.name || claims['cognito:username'],
    orgId: claims['custom:orgId'] || 'sparkboard-demo',
    groups: claims['cognito:groups'] ? claims['cognito:groups'].split(',') : [],
  };
}

async function getUserProfile(userId, orgId) {
  try {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `ORG#${orgId}`,
        SK: `USER#${userId}`,
      },
      ConsistentRead: true, // Use strongly consistent read to get latest data
    });

    const result = await docClient.send(command);
    return result.Item || null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

async function updateUserProfile(userId, orgId, updates) {
  try {
    const now = new Date().toISOString();
    
    // Get existing profile first
    const existing = await getUserProfile(userId, orgId);
    
    // Build UpdateExpression dynamically
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    // Always update updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;
    
    // Add each update field
    Object.keys(updates).forEach((key, index) => {
      const placeholder = `#field${index}`;
      const valuePlaceholder = `:value${index}`;
      updateExpressions.push(`${placeholder} = ${valuePlaceholder}`);
      expressionAttributeNames[placeholder] = key;
      expressionAttributeValues[valuePlaceholder] = updates[key];
    });
    
    // If this is the first time, set createdAt and required fields
    if (!existing) {
      updateExpressions.push('#createdAt = :createdAt');
      updateExpressions.push('#entityType = :entityType');
      updateExpressions.push('#userId = :userId');
      updateExpressions.push('#orgId = :orgId');
      expressionAttributeNames['#createdAt'] = 'createdAt';
      expressionAttributeNames['#entityType'] = 'entityType';
      expressionAttributeNames['#userId'] = 'userId';
      expressionAttributeNames['#orgId'] = 'orgId';
      expressionAttributeValues[':createdAt'] = now;
      expressionAttributeValues[':entityType'] = 'USER_PROFILE';
      expressionAttributeValues[':userId'] = userId;
      expressionAttributeValues[':orgId'] = orgId;
    }
    
    const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `ORG#${orgId}`,
        SK: `USER#${userId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);
    return result.Attributes;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

async function handleGetProfile(event) {
  const user = getUserFromEvent(event);
  if (!user) {
    return createResponse(401, {
      error: 'Unauthorized',
      message: 'No valid authorization token provided',
    });
  }

  // Get user profile from DynamoDB
  const profile = await getUserProfile(user.userId, user.orgId);

  return createResponse(200, {
    success: true,
    user: {
      ...user,
      // Use DynamoDB values if available, otherwise fall back to JWT claims
      name: profile?.name || user.name,
      email: profile?.email || user.email,
      bio: profile?.bio,
      avatarUrl: profile?.avatarUrl,
      theme: profile?.theme || 'system',
      createdAt: profile?.createdAt,
      updatedAt: profile?.updatedAt,
    },
    timestamp: new Date().toISOString(),
  });
}

async function handleUpdateProfile(event) {
  const user = getUserFromEvent(event);
  if (!user) {
    return createResponse(401, {
      error: 'Unauthorized',
      message: 'No valid authorization token provided',
    });
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return createResponse(400, {
      error: 'BadRequest',
      message: 'Invalid JSON in request body',
    });
  }

  // Validate and extract allowed fields
  const updates = {};
  
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'bio must be a string',
      });
    }
    if (body.bio.length > 500) {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'bio must be less than 500 characters',
      });
    }
    updates.bio = body.bio;
  }

  if (body.avatarUrl !== undefined) {
    if (typeof body.avatarUrl !== 'string') {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'avatarUrl must be a string',
      });
    }
    // Validate URL format
    try {
      new URL(body.avatarUrl);
    } catch (error) {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'avatarUrl must be a valid URL',
      });
    }
    updates.avatarUrl = body.avatarUrl;
  }

  if (body.theme !== undefined) {
    if (typeof body.theme !== 'string') {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'theme must be a string',
      });
    }
    // Validate theme value
    if (!['light', 'dark', 'system'].includes(body.theme)) {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'theme must be one of: light, dark, system',
      });
    }
    updates.theme = body.theme;
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'name must be a non-empty string',
      });
    }
    if (body.name.length > 100) {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'name must be less than 100 characters',
      });
    }
    updates.name = body.name.trim();
  }

  if (body.email !== undefined) {
    if (typeof body.email !== 'string') {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'email must be a string',
      });
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'email must be a valid email address',
      });
    }
    updates.email = body.email.toLowerCase();
  }

  if (Object.keys(updates).length === 0) {
    return createResponse(400, {
      error: 'ValidationError',
      message: 'No valid fields to update',
    });
  }

  // Update Cognito user attributes if name or email changed
  const cognitoUpdates = [];
  let emailChanged = false;
  
  if (updates.name) {
    cognitoUpdates.push({ Name: 'name', Value: updates.name });
  }
  if (updates.email) {
    // Check if email actually changed
    if (updates.email !== user.email) {
      cognitoUpdates.push({ Name: 'email', Value: updates.email });
      cognitoUpdates.push({ Name: 'email_verified', Value: 'false' }); // Will need verification
      emailChanged = true;
    }
  }

  if (cognitoUpdates.length > 0) {
    try {
      const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const cognitoClient = new CognitoIdentityProviderClient({});
      
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: user.username,
        UserAttributes: cognitoUpdates,
      }));
      
      console.log('Cognito attributes updated:', cognitoUpdates.map(u => u.Name));
    } catch (error) {
      console.error('Failed to update Cognito attributes:', error);
      return createResponse(500, {
        error: 'InternalServerError',
        message: 'Failed to update user attributes in Cognito',
        details: error.message,
      });
    }
  }

  // Update profile in DynamoDB
  try {
    const profile = await updateUserProfile(user.userId, user.orgId, updates);
    
    return createResponse(200, {
      success: true,
      user: {
        ...user,
        name: profile.name || user.name,
        email: profile.email || user.email,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        theme: profile.theme || 'system',
        updatedAt: profile.updatedAt,
      },
      message: 'Profile updated successfully',
      ...(emailChanged && { warning: 'Email verification required. Please check your inbox.' }),
    });
  } catch (error) {
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to update profile',
    });
  }
}

exports.handler = async (event) => {
  console.log('Auth handler invoked:', {
    httpMethod: event.httpMethod,
    path: event.path,
  });

  const httpMethod = event.httpMethod;

  try {
    switch (httpMethod) {
      case 'GET':
        return await handleGetProfile(event);
      case 'PATCH':
        return await handleUpdateProfile(event);
      case 'OPTIONS':
        return createResponse(200, { message: 'OK' });
      default:
        return createResponse(405, {
          error: 'MethodNotAllowed',
          message: `Method ${httpMethod} not allowed`,
        });
    }
  } catch (error) {
    console.error('Unexpected error in auth handler:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    });
  }
};
