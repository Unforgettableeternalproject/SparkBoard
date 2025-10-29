/**
 * Items Lambda Handler
 * POST /items - Create a new item
 * GET /items - Query items with pagination
 * DELETE /items/:sk - Delete an item
 * Requires Cognito JWT token in Authorization header
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

const TABLE_NAME = process.env.TABLE_NAME;

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
  return {
    userId: claims.sub,
    username: claims['cognito:username'] || claims.username,
    email: claims.email,
    orgId: claims['custom:orgId'] || 'sparkboard-demo',
    groups: claims['cognito:groups'] ? claims['cognito:groups'].split(',') : [],
  };
}

/**
 * POST /items - Create a new item
 */
async function createItem(event) {
  console.log('Creating item:', JSON.stringify(event, null, 2));

  try {
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

    // Validate required fields
    const { title, content, type, attachments } = body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'Title is required and must be a non-empty string',
      });
    }

    // Generate IDs and timestamps
    const itemId = uuidv4();
    const createdAt = new Date().toISOString();
    const orgId = user.orgId;

    // Prepare item for DynamoDB
    const item = {
      // Primary key: ORG#<orgId> / ITEM#<itemId>
      PK: `ORG#${orgId}`,
      SK: `ITEM#${itemId}`,
      pk: `ORG#${orgId}`,
      sk: `ITEM#${itemId}`,
      
      // GSI1: Query items by user
      GSI1PK: `USER#${user.userId}`,
      GSI1SK: `ITEM#${createdAt}`,
      
      // GSI2: Query all items by creation time (for global feed)
      GSI2PK: 'ITEM#ALL',
      GSI2SK: createdAt,
      
      // Entity type and data
      entityType: 'ITEM',
      itemId,
      orgId,
      userId: user.userId,
      username: user.username,
      email: user.email,
      
      title: title.trim(),
      content: content?.trim() || '',
      type: type || 'task', // task, announcement, etc.
      status: 'active',
      attachments: attachments || [],
      
      createdAt,
      updatedAt: createdAt,
    };

    // Save to DynamoDB
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    });

    await docClient.send(command);

    console.log('Item created successfully:', itemId);

    return createResponse(201, {
      success: true,
      item: {
        id: item.itemId,
        itemId: item.itemId,
        pk: item.pk,
        sk: item.sk,
        orgId: item.orgId,
        userId: item.userId,
        userName: item.username,
        username: item.username,
        title: item.title,
        content: item.content,
        type: item.type,
        status: item.status,
        attachments: item.attachments,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating item:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to create item',
      details: error.message,
    });
  }
}

/**
 * GET /items - Query items with pagination
 */
async function getItems(event) {
  console.log('Getting items:', JSON.stringify(event, null, 2));

  try {
    const user = getUserFromEvent(event);
    if (!user) {
      return createResponse(401, {
        error: 'Unauthorized',
        message: 'No valid authorization token provided',
      });
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit || '20', 10);
    const nextToken = queryParams.nextToken;

    // Validate limit
    if (limit < 1 || limit > 100) {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'Limit must be between 1 and 100',
      });
    }

    // Prepare query using GSI2 (all items sorted by creation time)
    const queryInput = {
      TableName: TABLE_NAME,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :gsi2pk',
      ExpressionAttributeValues: {
        ':gsi2pk': 'ITEM#ALL',
      },
      ScanIndexForward: false, // Sort descending (newest first)
      Limit: limit,
    };

    // Add pagination token if provided
    if (nextToken) {
      try {
        queryInput.ExclusiveStartKey = JSON.parse(
          Buffer.from(nextToken, 'base64').toString('utf8')
        );
      } catch (error) {
        return createResponse(400, {
          error: 'ValidationError',
          message: 'Invalid nextToken format',
        });
      }
    }

    // Execute query
    const command = new QueryCommand(queryInput);
    const result = await docClient.send(command);

    // Format items for response
    const items = (result.Items || []).map((item) => ({
      id: item.itemId,
      pk: item.pk,
      sk: item.sk,
      orgId: item.orgId,
      userId: item.userId,
      userName: item.username,
      title: item.title,
      content: item.content,
      type: item.type,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      attachments: item.attachments,
    }));

    // Generate next token if there are more results
    let responseNextToken = null;
    if (result.LastEvaluatedKey) {
      responseNextToken = Buffer.from(
        JSON.stringify(result.LastEvaluatedKey)
      ).toString('base64');
    }

    console.log(`Retrieved ${items.length} items`);

    return createResponse(200, {
      success: true,
      items,
      count: items.length,
      nextToken: responseNextToken,
      hasMore: !!responseNextToken,
    });
  } catch (error) {
    console.error('Error getting items:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to retrieve items',
      details: error.message,
    });
  }
}

/**
 * DELETE /items/:sk - Delete an item
 */
async function deleteItem(event) {
  console.log('Deleting item:', JSON.stringify(event, null, 2));

  try {
    const user = getUserFromEvent(event);
    if (!user) {
      return createResponse(401, {
        error: 'Unauthorized',
        message: 'No valid authorization token provided',
      });
    }

    // Extract item SK from path parameters
    const sk = event.pathParameters?.sk;
    if (!sk) {
      return createResponse(400, {
        error: 'BadRequest',
        message: 'Item SK is required',
      });
    }

    // Check if user is admin
    const groups = user.groups || [];
    const isAdmin = groups.includes('Admin');

    // If not admin, verify the item belongs to the user
    if (!isAdmin) {
      // First, query the item to check ownership
      const queryCommand = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `ORG#${user.orgId}`,
          ':sk': sk,
        },
      });

      const queryResult = await docClient.send(queryCommand);
      
      if (!queryResult.Items || queryResult.Items.length === 0) {
        return createResponse(404, {
          error: 'NotFound',
          message: 'Item not found',
        });
      }

      const item = queryResult.Items[0];
      if (item.userId !== user.userId) {
        return createResponse(403, {
          error: 'Forbidden',
          message: 'You do not have permission to delete this item',
        });
      }
    }

    // Delete the item
    const deleteCommand = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `ORG#${user.orgId}`,
        SK: sk,
      },
    });

    await docClient.send(deleteCommand);

    console.log('Item deleted successfully:', sk);

    return createResponse(200, {
      success: true,
      message: 'Item deleted successfully',
      sk,
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to delete item',
      details: error.message,
    });
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Items handler invoked:', {
    httpMethod: event.httpMethod,
    path: event.path,
    resource: event.resource,
  });

  const httpMethod = event.httpMethod;

  try {
    switch (httpMethod) {
      case 'POST':
        return await createItem(event);
      case 'GET':
        return await getItems(event);
      case 'DELETE':
        return await deleteItem(event);
      case 'OPTIONS':
        // Handle CORS preflight
        return createResponse(200, { message: 'OK' });
      default:
        return createResponse(405, {
          error: 'MethodNotAllowed',
          message: `Method ${httpMethod} not allowed`,
        });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    });
  }
};
