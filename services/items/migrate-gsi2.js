/**
 * Migration Script: Add GSI2 attributes to existing items
 * 
 * This script scans all items in the SparkTable and adds GSI2PK and GSI2SK
 * attributes to items that don't have them.
 * 
 * GSI2PK = 'ITEM#ALL' (for all items)
 * GSI2SK = createdAt (ISO timestamp)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = 'SparkTable';
const REGION = 'ap-northeast-1';

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function migrateItems() {
  console.log('Starting migration: Adding GSI2 attributes to existing items...\n');

  let totalScanned = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
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
      totalScanned += items.length;

      console.log(`Scanned ${items.length} items...`);

      // Process each item
      for (const item of items) {
        console.log(`Checking: PK=${item.PK}, SK=${item.SK}, GSI2PK=${item.GSI2PK}, GSI2SK=${item.GSI2SK}`);
        
        // Only process ITEM entities
        if (!item.SK || !item.SK.startsWith('ITEM#')) {
          totalSkipped++;
          console.log(`  → Skipped (not an ITEM)`);
          continue;
        }

        // Skip if already has GSI2 attributes
        if (item.GSI2PK && item.GSI2SK) {
          totalSkipped++;
          console.log(`  → Skipped (already has GSI2)`);
          continue;
        }

        // Update item with GSI2 attributes
        try {
          const updateCommand = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
            UpdateExpression: 'SET GSI2PK = :gsi2pk, GSI2SK = :gsi2sk',
            ExpressionAttributeValues: {
              ':gsi2pk': 'ITEM#ALL',
              ':gsi2sk': item.createdAt || new Date().toISOString(),
            },
          });

          await docClient.send(updateCommand);
          totalUpdated++;
          console.log(`✓ Updated ${item.SK} (${item.title || 'Untitled'})`);
        } catch (error) {
          console.error(`✗ Failed to update ${item.SK}:`, error.message);
        }
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;

      if (lastEvaluatedKey) {
        console.log('Continuing to next page...\n');
      }
    } while (lastEvaluatedKey);

    console.log('\n=== Migration Complete ===');
    console.log(`Total items scanned: ${totalScanned}`);
    console.log(`Items updated: ${totalUpdated}`);
    console.log(`Items skipped: ${totalSkipped}`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateItems()
  .then(() => {
    console.log('\nMigration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
