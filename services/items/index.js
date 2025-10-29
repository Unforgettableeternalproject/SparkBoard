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
const { getUserFromEvent, checkPermission, createResponse, createErrorResponse } = require('../shared/permissions');

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
    const { title, content, type, attachments, subtasks, deadline, priority, expiresAt } = body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return createErrorResponse(400, 'ValidationError', 'Title is required and must be a non-empty string');
    }

    // Check permissions based on type
    const itemType = type || 'task';
    if (itemType === 'announcement' && !checkPermission(user, 'create:announcement')) {
      return createErrorResponse(403, 'Forbidden', 'Only moderators and admins can create announcements');
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
      type: itemType,
      attachments: attachments || [],
      
      createdAt,
      updatedAt: createdAt,
    };

    // Add type-specific fields
    if (itemType === 'task') {
      item.status = 'active';
      item.subtasks = subtasks || [];
      if (deadline) item.deadline = deadline;
    } else if (itemType === 'announcement') {
      item.priority = priority || 'normal';
      if (expiresAt) item.expiresAt = expiresAt;
    }

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
        // Task-specific fields
        subtasks: item.subtasks,
        deadline: item.deadline,
        completedAt: item.completedAt,
        // Announcement-specific fields
        priority: item.priority,
        expiresAt: item.expiresAt,
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
      // Task-specific fields
      subtasks: item.subtasks,
      deadline: item.deadline,
      completedAt: item.completedAt,
      // Announcement-specific fields
      priority: item.priority,
      expiresAt: item.expiresAt,
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
      return createErrorResponse(400, 'BadRequest', 'Item SK is required');
    }

    // Query the item to check ownership and type
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
      return createErrorResponse(404, 'NotFound', 'Item not found');
    }

    const item = queryResult.Items[0];
    
    // Check permissions based on item type and ownership
    const action = item.type === 'announcement' ? 'delete:announcement' : 'delete:task';
    const resource = { userId: item.userId };
    
    if (!checkPermission(user, action, resource)) {
      return createErrorResponse(403, 'Forbidden', 'You do not have permission to delete this item');
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
