# Uploads Service

Lambda handler for generating S3 presigned URLs for secure file uploads.

## API Endpoint

### POST /uploads/presign

Generate a presigned URL for uploading files to S3.

**Authentication:** Required (Cognito JWT)

**Request Body:**
```json
{
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "fileSize": 1024000
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "upload": {
    "url": "https://sparkboard-files-xxx.s3.amazonaws.com/userId/2025-10-29/uuid-document.pdf?X-Amz-...",
    "key": "test-user-123/2025-10-29/abc123-document.pdf",
    "bucket": "sparkboard-files-xxx",
    "expiresIn": 300,
    "method": "PUT",
    "headers": {
      "Content-Type": "application/pdf"
    },
    "metadata": {
      "userId": "test-user-123",
      "fileName": "document.pdf",
      "contentType": "application/pdf",
      "fileSize": 1024000,
      "uploadedAt": "2025-10-29T12:00:00.000Z"
    }
  }
}
```

## File Upload Flow

### 1. Request Presigned URL

```javascript
const response = await fetch('https://api.sparkboard.com/uploads/presign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size
  })
});

const { upload } = await response.json();
```

### 2. Upload File to S3

```javascript
await fetch(upload.url, {
  method: 'PUT',
  headers: {
    'Content-Type': upload.headers['Content-Type']
  },
  body: file
});
```

### 3. Use File Key

```javascript
// Save the key to your item/record
const item = {
  title: 'My Document',
  attachments: [upload.key]
};
```

## Allowed File Types

- **Images:** JPEG, PNG, GIF, WebP
- **Documents:** PDF, DOC, DOCX, XLS, XLSX
- **Text:** TXT, CSV

## Constraints

- **Max File Size:** 10MB
- **URL Expiration:** 5 minutes
- **File Naming:** Sanitized automatically (special characters replaced with `_`)

## S3 Key Structure

Files are stored with the following structure:
```
{userId}/{YYYY-MM-DD}/{uuid}-{sanitized-filename}.{extension}
```

Example:
```
test-user-123/2025-10-29/abc-123-def-456-document.pdf
```

## Metadata

Each uploaded file includes metadata:
- `uploaded-by`: User ID
- `uploaded-at`: ISO timestamp
- `original-filename`: Original file name

## Error Handling

### 400 Bad Request
- Missing `fileName` or `contentType`
- Disallowed content type
- File size exceeds limit

### 401 Unauthorized
- Missing or invalid JWT token

### 500 Internal Server Error
- S3 service unavailable
- Failed to generate presigned URL

## Testing

Run unit tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Environment Variables

- `BUCKET_NAME`: S3 bucket name (e.g., `sparkboard-files-xxx`)
- `AWS_REGION`: AWS region (e.g., `ap-northeast-1`)
- `NODE_ENV`: Environment (development, production, test)

## Security Considerations

1. **User Isolation**: Files are stored in user-specific folders
2. **Content Type Validation**: Only allowed types can be uploaded
3. **Size Limits**: Prevents large file uploads
4. **Expiring URLs**: Presigned URLs expire after 5 minutes
5. **CORS Configured**: S3 bucket has proper CORS rules

## CORS Configuration

S3 bucket must allow:
- Methods: `GET`, `PUT`, `POST`, `HEAD`
- Headers: `Content-Type`, `Content-Length`, `Authorization`, etc.
- Origins: Your frontend domains

This is configured automatically in `storage-stack.ts`.

## Dependencies

- `@aws-sdk/client-s3`: S3 client
- `@aws-sdk/s3-request-presigner`: Generate presigned URLs
- `uuid`: Generate unique file IDs

## Development Dependencies

- `jest`: Testing framework
