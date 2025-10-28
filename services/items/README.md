# Items Service

Lambda handler for managing items (tasks, announcements, etc.) in SparkBoard.

## API Endpoints

### POST /items

Create a new item.

**Authentication:** Required (Cognito JWT)

**Request Body:**
```json
{
  "title": "Task Title",
  "content": "Task description or content",
  "type": "task"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "item": {
    "itemId": "uuid-v4",
    "orgId": "sparkboard-demo",
    "userId": "user-id",
    "username": "username",
    "title": "Task Title",
    "content": "Task description or content",
    "type": "task",
    "status": "active",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Validation:**
- `title` is required and must be a non-empty string
- `content` is optional (defaults to empty string)
- `type` is optional (defaults to "task")

### GET /items

Query items with pagination.

**Authentication:** Required (Cognito JWT)

**Query Parameters:**
- `limit` (optional): Number of items to return (1-100, default: 20)
- `nextToken` (optional): Pagination token for next page

**Response (200 OK):**
```json
{
  "success": true,
  "items": [
    {
      "itemId": "uuid-v4",
      "orgId": "sparkboard-demo",
      "userId": "user-id",
      "username": "username",
      "title": "Task Title",
      "content": "Task description",
      "type": "task",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "count": 20,
  "nextToken": "base64-encoded-token",
  "hasMore": true
}
```

**Pagination:**
- Items are sorted by creation time (newest first)
- Use `nextToken` from response to fetch next page
- `hasMore` indicates if more results are available

## DynamoDB Schema

Items use a single-table design with the following key structure:

### Main Table Keys
- **PK**: `ORG#<orgId>`
- **SK**: `ITEM#<itemId>`

### GSI1 - User Items Index
- **GSI1PK**: `USER#<userId>`
- **GSI1SK**: `ITEM#<createdAt>`
- Purpose: Query all items by a specific user

### GSI2 - Global Feed Index
- **GSI2PK**: `ITEM#ALL`
- **GSI2SK**: `<createdAt>`
- Purpose: Query all items sorted by creation time (used by GET /items)

## Testing

Run unit tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Environment Variables

- `TABLE_NAME`: DynamoDB table name (e.g., `SparkTable`)
- `NODE_ENV`: Environment (development, production, test)

## Error Handling

All errors return appropriate HTTP status codes:

- **400 Bad Request**: Invalid input or validation errors
- **401 Unauthorized**: Missing or invalid JWT token
- **405 Method Not Allowed**: Unsupported HTTP method
- **500 Internal Server Error**: Server-side errors

## Dependencies

- `@aws-sdk/client-dynamodb`: DynamoDB client
- `@aws-sdk/lib-dynamodb`: DynamoDB document client with simplified operations
- `uuid`: Generate unique item IDs

## Development Dependencies

- `jest`: Testing framework
