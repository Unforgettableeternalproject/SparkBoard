const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { CognitoIdentityProviderClient, AdminGetUserCommand, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const snsClient = new SNSClient({});
const cognitoClient = new CognitoIdentityProviderClient({});

const TABLE_NAME = process.env.TABLE_NAME;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const USER_POOL_ID = process.env.USER_POOL_ID;

/**
 * Get user email from Cognito
 */
async function getUserEmail(userId) {
  try {
    // Try to get user by sub (userId)
    const listCommand = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `sub = "${userId}"`,
      Limit: 1,
    });
    
    const listResult = await cognitoClient.send(listCommand);
    
    if (listResult.Users && listResult.Users.length > 0) {
      const user = listResult.Users[0];
      const emailAttr = user.Attributes?.find(attr => attr.Name === 'email');
      return emailAttr?.Value;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}

/**
 * Get item details from DynamoDB
 */
async function getItemDetails(orgId, itemId) {
  try {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `ORG#${orgId}`,
        SK: `ITEM#${itemId}`,
      },
    });
    
    const result = await docClient.send(command);
    return result.Item;
  } catch (error) {
    console.error('Error getting item details:', error);
    return null;
  }
}

/**
 * Send email notification via SNS
 */
async function sendEmailNotification(email, subject, message) {
  try {
    const command = new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: subject,
      Message: message,
      MessageAttributes: {
        email: {
          DataType: 'String',
          StringValue: email,
        },
      },
    });
    
    await snsClient.send(command);
    console.log(`Email notification sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending email notification:', error);
    return false;
  }
}

/**
 * Process task completion notification
 */
async function processTaskCompletion(event) {
  const { userId, itemId, orgId, title, completedBy } = event;
  
  console.log('Processing task completion:', { userId, itemId, title });
  
  // Get user email
  const userEmail = await getUserEmail(userId);
  if (!userEmail) {
    console.error('User email not found for userId:', userId);
    return false;
  }
  
  // Get item details
  const item = await getItemDetails(orgId, itemId);
  if (!item) {
    console.error('Item not found:', itemId);
    return false;
  }
  
  // Prepare email content
  const subject = `✅ Task Completed: ${title}`;
  const message = `
Hi there,

Your task "${title}" has been marked as completed.

Task Details:
- Title: ${title}
- Completed by: ${completedBy || 'Unknown'}
- Completed at: ${new Date().toLocaleString()}
${item.deadline ? `- Original deadline: ${new Date(item.deadline).toLocaleString()}` : ''}

${item.subtasks && item.subtasks.length > 0 ? `
Subtasks (${item.subtasks.filter(st => st.completed).length}/${item.subtasks.length} completed):
${item.subtasks.map(st => `  ${st.completed ? '✓' : '○'} ${st.title}`).join('\n')}
` : ''}

View your tasks at: ${process.env.FRONTEND_URL || 'https://sparkboard.example.com'}

---
SparkBoard Notification System
This is an automated message. Please do not reply.
  `.trim();
  
  return await sendEmailNotification(userEmail, subject, message);
}

/**
 * Process task assignment notification
 */
async function processTaskAssignment(event) {
  const { userId, itemId, orgId, title, assignedBy } = event;
  
  console.log('Processing task assignment:', { userId, itemId, title });
  
  const userEmail = await getUserEmail(userId);
  if (!userEmail) {
    console.error('User email not found for userId:', userId);
    return false;
  }
  
  const item = await getItemDetails(orgId, itemId);
  if (!item) {
    console.error('Item not found:', itemId);
    return false;
  }
  
  const subject = `📋 New Task Assigned: ${title}`;
  const message = `
Hi there,

A new task has been assigned to you.

Task Details:
- Title: ${title}
- Assigned by: ${assignedBy || 'System'}
- Created at: ${new Date(item.createdAt).toLocaleString()}
${item.deadline ? `- Deadline: ${new Date(item.deadline).toLocaleString()}` : '- No deadline set'}
${item.priority ? `- Priority: ${item.priority}` : ''}

${item.content ? `
Description:
${item.content}
` : ''}

${item.subtasks && item.subtasks.length > 0 ? `
Subtasks (${item.subtasks.length} total):
${item.subtasks.map(st => `  ○ ${st.title}`).join('\n')}
` : ''}

View and manage your tasks at: ${process.env.FRONTEND_URL || 'https://sparkboard.example.com'}

---
SparkBoard Notification System
  `.trim();
  
  return await sendEmailNotification(userEmail, subject, message);
}

/**
 * Process task deletion notification (for overdue inactive tasks)
 */
async function processTaskDeletion(event) {
  const { userId, itemId, title, deadline, status, reason, deletedAt } = event;
  
  console.log('Processing task deletion:', { userId, itemId, title, reason });
  
  // Get user email
  const userEmail = await getUserEmail(userId);
  if (!userEmail) {
    console.error('User email not found for userId:', userId);
    return false;
  }
  
  const reasonText = reason === 'overdue_inactive' 
    ? 'the task was overdue and remained incomplete' 
    : 'of inactivity';
  
  // Prepare email content
  const subject = `🗑️ Task Deleted: ${title}`;
  const message = `
Hi there,

Your task "${title}" has been automatically deleted because ${reasonText}.

Task Details:
- Title: ${title}
- Status at deletion: ${status}
- Deadline was: ${deadline ? new Date(deadline).toLocaleString() : 'Not set'}
- Deleted at: ${new Date(deletedAt).toLocaleString()}

💡 Tip: Tasks that are not completed by their deadline will be automatically removed to keep your workspace clean.

If you still need to work on this task, you can create a new one at: ${process.env.FRONTEND_URL || 'https://sparkboard.example.com'}

---
SparkBoard Notification System
This is an automated message. Please do not reply.
  `.trim();
  
  return await sendEmailNotification(userEmail, subject, message);
}

/**
 * Process announcement notification
 * Sends email to all users in the Cognito User Pool (with pagination support)
 */
async function processAnnouncement(event) {
  const { title, content, priority, createdBy, orgId } = event;
  
  console.log('Processing announcement notification:', { title, priority, orgId });
  
  // Get all users in the organization (with pagination)
  try {
    let allUsers = [];
    let paginationToken = undefined;
    let totalFetched = 0;
    const MAX_USERS = 500; // Safety limit to prevent infinite loops
    
    // Fetch all users with pagination
    do {
      const listCommand = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Limit: 60, // AWS maximum per request
        PaginationToken: paginationToken,
      });
      
      const response = await cognitoClient.send(listCommand);
      
      if (response.Users && response.Users.length > 0) {
        allUsers = allUsers.concat(response.Users);
        totalFetched += response.Users.length;
        console.log(`Fetched ${response.Users.length} users, total: ${totalFetched}`);
      }
      
      paginationToken = response.PaginationToken;
      
      // Safety check
      if (totalFetched >= MAX_USERS) {
        console.warn(`Reached maximum user limit (${MAX_USERS}), stopping pagination`);
        break;
      }
    } while (paginationToken);
    
    console.log(`Total users to notify: ${allUsers.length}`);
    
    if (allUsers.length === 0) {
      console.log('No users found to notify');
      return true;
    }
    
    const subject = `${priority === 'urgent' ? '🚨' : priority === 'high' ? '⚠️' : '📢'} Announcement: ${title}`;
    const message = `
SparkBoard Announcement

${content}

---
Posted by: ${createdBy || 'System'}
Priority: ${priority || 'Normal'}
Time: ${new Date().toLocaleString()}

View more at: ${process.env.FRONTEND_URL || 'https://sparkboard.example.com'}

---
SparkBoard Notification System
    `.trim();
    
    // Send to all users in batches to avoid overwhelming SNS
    let successCount = 0;
    let failureCount = 0;
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
      const batch = allUsers.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (user) => {
        const emailAttr = user.Attributes?.find(attr => attr.Name === 'email');
        if (emailAttr?.Value) {
          try {
            const success = await sendEmailNotification(emailAttr.Value, subject, message);
            return success;
          } catch (error) {
            console.error(`Failed to send to ${emailAttr.Value}:`, error);
            return false;
          }
        }
        return false;
      });
      
      const results = await Promise.all(batchPromises);
      successCount += results.filter(r => r).length;
      failureCount += results.filter(r => !r).length;
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < allUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Announcement sent: ${successCount} successful, ${failureCount} failed out of ${allUsers.length} users`);
    return true;
  } catch (error) {
    console.error('Error processing announcement:', error);
    return false;
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Notification handler triggered:', JSON.stringify(event, null, 2));
  
  const results = [];
  
  // Process each SQS message
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      console.log('Processing message:', message);
      
      let success = false;
      
      switch (message.type) {
        case 'TASK_COMPLETED':
          success = await processTaskCompletion(message);
          break;
        
        case 'TASK_ASSIGNED':
          success = await processTaskAssignment(message);
          break;
        
        case 'TASK_DELETED':
          success = await processTaskDeletion(message);
          break;
        
        case 'ANNOUNCEMENT':
          success = await processAnnouncement(message);
          break;
        
        default:
          console.warn('Unknown message type:', message.type);
          success = true; // Don't retry unknown types
      }
      
      results.push({
        messageId: record.messageId,
        success,
      });
      
    } catch (error) {
      console.error('Error processing message:', error);
      results.push({
        messageId: record.messageId,
        success: false,
        error: error.message,
      });
    }
  }
  
  // Check if any messages failed
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.error('Some messages failed:', failures);
    // Return failure to retry the failed messages
    throw new Error(`${failures.length} message(s) failed processing`);
  }
  
  console.log('All messages processed successfully');
  return {
    statusCode: 200,
    body: JSON.stringify({
      processed: results.length,
      successful: results.filter(r => r.success).length,
    }),
  };
};
