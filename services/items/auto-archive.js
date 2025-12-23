/**
 * Auto-archive Lambda - Runs periodically to archive completed tasks and delete overdue ones
 * Triggered by EventBridge rule every 1 minute
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const sqsClient = new SQSClient({});

const TABLE_NAME = process.env.TABLE_NAME;
const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL;

/**
 * Calculate archive status based on task status and subtasks
 */
function calculateArchiveStatus(item) {
  // If task itself is not completed, it's aborted
  if (item.status !== 'completed') {
    return 'aborted';
  }
  
  const subtasks = item.subtasks || [];
  
  // No subtasks: completed if status is completed
  if (subtasks.length === 0) {
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
 * Send notification to SQS queue
 */
async function sendNotification(message) {
  if (!NOTIFICATION_QUEUE_URL) {
    console.warn('NOTIFICATION_QUEUE_URL not set, skipping notification');
    return;
  }
deletedCount = 0;
  let errorCount = 0;
  
  try {
    console.log('Current time:', now);
    console.log('Table name:', TABLE_NAME);
    
    // ===== Part 1: Archive completed tasks with autoArchiveAt =====
    const archiveScanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'entityType = :type AND attribute_exists(autoArchiveAt) AND autoArchiveAt <= :now AND attribute_not_exists(archivedAt)',
      ExpressionAttributeValues: {
        ':type': 'ITEM',
        ':now': now,
      },
    });
    
    console.log('Scanning for tasks to archive...');
    const archiveResult = await docClient.send(archiveScanCommand);
    console.log(`Found ${archiveResult.Items?.length || 0} completed tasks to archive`);
    
    // Archive each completed task
    if (archiveResult.Items && archiveResult.Items.length > 0) {
      for (const item of archiveResult.Items) {
        try {
          const archiveStatus = calculateArchiveStatus(item);
          
          console.log(`Archiving task ${item.SK}:`, {
            title: item.title,
            status: item.status,
            completedAt: item.completedAt,
            autoArchiveAt: item.autoArchiveAt,
            subtasksCount: item.subtasks?.length || 0,
            archiveStatus,
          });
          
          const updateCommand = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
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
          
          console.log(`✓ Auto-archived task: ${item.SK} (${item.title}) with status: ${archiveStatus}`);
        } catch (error) {
          console.error(`✗ Error archiving task ${item.SK}:`, error);
          errorCount++;
        }
      }
    }
    
    // ===== Part 2: Delete overdue To do tasks (only pending status) =====
    const deleteScanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'entityType = :type AND #status = :pending AND attribute_exists(deadline) AND deadline < :now AND attribute_not_exists(archivedAt)',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':type': 'ITEM',
        ':pending': 'pending',
        ':now': now,
      },
    });
    
    console.log('Scanning for overdue To do tasks to delete...');
    const deleteResult = await docClient.send(deleteScanCommand);
    console.log(`Found ${deleteResult.Items?.length || 0} overdue To do tasks to delete`);
    
    // Delete each overdue To do task
    if (deleteResult.Items && deleteResult.Items.length > 0) {
      for (const item of deleteResult.Items) {
        try {
          console.log(`Deleting overdue To do task ${item.SK}:`, {
            title: item.title,
            status: item.status,
            deadline: item.deadline,
            createdAt: item.createdAt,
            ownerId: item.ownerId,
          });
          
          // Extract userId from PK (format: USER#userId or ORG#orgId)
          const userId = item.ownerId || item.PK.replace(/^(USER|ORG)#/, '');
          
          // Send notification before deleting
          await sendNotification({
            type: 'TASK_DELETED',
            userId: userId,
            itemId: item.SK.replace('ITEM#', ''),
            title: item.title,
            deadline: item.deadline,
            status: item.status,
            reason: 'overdue_inactive',
            deletedAt: now,
          });
          
          // Delete the task
          const deleteCommand = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
          });
          
          await docClient.send(deleteCommand);
          deletedCount++;
          
          console.log(`✓ Deleted overdue To do task: ${item.SK} (${item.title})`);
        } catch (error) {
          console.error(`✗ Error deleting To do task ${item.SK}:`, error);
          errorCount++;
        }
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Auto-archive and cleanup completed',
        archivedCount,
        deletteExpression: 'SET archivedAt = :archivedAt, archiveStatus = :archiveStatus, updatedAt = :updatedAt REMOVE autoArchiveAt',
          ExpressionAttributeValues: {
            ':archivedAt': now,
            ':archiveStatus': archiveStatus,
            ':updatedAt': now,
          },
          ReturnValues: 'ALL_NEW',
        });
        
        await docClient.send(updateCommand);
        archivedCount++;
        
        console.log(`✓ Auto-archived task: ${item.SK} (${item.title}) with status: ${archiveStatus}`);
      } catch (error) {
        console.error(`✗ Error archiving task ${item.SK}:`, error);
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
