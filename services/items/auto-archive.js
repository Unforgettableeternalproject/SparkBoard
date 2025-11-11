/**
 * Auto-archive Lambda - Runs periodically to archive completed tasks
 * Triggered by EventBridge rule every 1 minute
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'sparkboard-table-prod';

/**
 * Calculate archive status based on subtasks
 */
function calculateArchiveStatus(subtasks) {
  if (!subtasks || subtasks.length === 0) {
    return 'completed';
  }
  
  const completedCount = subtasks.filter(st => st.completed).length;
  
  if (completedCount === 0) {
    return 'aborted';
  } else if (completedCount === subtasks.length) {
    return 'completed';
  } else {
    return 'partial';
  }
}

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('Auto-archive Lambda triggered');
  
  const now = new Date().toISOString();
  let archivedCount = 0;
  let errorCount = 0;
  
  try {
    // Scan for tasks that need auto-archiving
    // Note: In production, you'd want to use a GSI for this query
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'entityType = :type AND attribute_exists(autoArchiveAt) AND autoArchiveAt <= :now AND attribute_not_exists(archivedAt)',
      ExpressionAttributeValues: {
        ':type': 'ITEM',
        ':now': now,
      },
    });
    
    const result = await docClient.send(scanCommand);
    console.log(`Found ${result.Items?.length || 0} tasks to auto-archive`);
    
    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No tasks to archive',
          archivedCount: 0,
        }),
      };
    }
    
    // Archive each task
    for (const item of result.Items) {
      try {
        const archiveStatus = calculateArchiveStatus(item.subtasks);
        
        const updateCommand = new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            pk: item.pk,
            sk: item.sk,
          },
          UpdateExpression: 'SET archivedAt = :archivedAt, archiveStatus = :archiveStatus, updatedAt = :updatedAt REMOVE autoArchiveAt',
          ExpressionAttributeValues: {
            ':archivedAt': now,
            ':archiveStatus': archiveStatus,
            ':updatedAt': now,
          },
          ReturnValues: 'ALL_NEW',
        });
        
        await docClient.send(updateCommand);
        archivedCount++;
        
        console.log(`Auto-archived task: ${item.sk} with status: ${archiveStatus}`);
      } catch (error) {
        console.error(`Error archiving task ${item.sk}:`, error);
        errorCount++;
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Auto-archive completed',
        archivedCount,
        errorCount,
        timestamp: now,
      }),
    };
    
  } catch (error) {
    console.error('Error in auto-archive:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Auto-archive failed',
        message: error.message,
      }),
    };
  }
};
