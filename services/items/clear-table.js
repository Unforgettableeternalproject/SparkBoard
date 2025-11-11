/**
 * Clear all items from SparkTable
 * WARNING: This will delete ALL data in the table!
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = 'SparkTable';
const REGION = 'ap-northeast-1';

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function clearTable() {
  console.log('WARNING: Clearing all data from SparkTable...\n');

  let totalDeleted = 0;
  let lastEvaluatedKey = undefined;

  try {
    do {
      // Scan the table
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const scanResult = await docClient.send(scanCommand);
      const items = scanResult.Items || [];

      console.log(`Found ${items.length} items to delete...`);

      // Delete each item
      for (const item of items) {
        try {
          const deleteCommand = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
          });

          await docClient.send(deleteCommand);
          totalDeleted++;
          console.log(`✓ Deleted: ${item.PK} / ${item.SK}`);
        } catch (error) {
          console.error(`✗ Failed to delete ${item.PK}/${item.SK}:`, error.message);
        }
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;

      if (lastEvaluatedKey) {
        console.log('Continuing to next page...\n');
      }
    } while (lastEvaluatedKey);

    console.log('\n=== Clear Complete ===');
    console.log(`Total items deleted: ${totalDeleted}`);
  } catch (error) {
    console.error('Clear failed:', error);
    process.exit(1);
  }
}

// Run clear
clearTable()
  .then(() => {
    console.log('\nTable cleared successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nClear failed:', error);
    process.exit(1);
  });
