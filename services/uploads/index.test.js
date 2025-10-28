/**
 * Unit tests for uploads handlers
 * Run with: npm test
 */

const { handler } = require('./index');

// Mock environment variables
process.env.BUCKET_NAME = 'sparkboard-files-test';
process.env.AWS_REGION = 'ap-northeast-1';
process.env.NODE_ENV = 'test';

// Mock AWS SDK
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({})),
  PutObjectCommand: jest.fn((params) => params),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args) => mockGetSignedUrl(...args),
}));

// Helper to create mock Cognito event
function createMockEvent(httpMethod, body = null) {
  return {
    httpMethod,
    path: '/uploads/presign',
    resource: '/uploads/presign',
    body: body ? JSON.stringify(body) : null,
    requestContext: {
      authorizer: {
        claims: {
          sub: 'test-user-123',
          'cognito:username': 'testuser',
          username: 'testuser',
          email: 'test@example.com',
          'custom:orgId': 'test-org',
        },
      },
    },
  };
}

describe('Uploads Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /uploads/presign', () => {
    test('should generate presigned URL for valid image upload', async () => {
      const mockUrl = 'https://s3.amazonaws.com/test-bucket/test-key?signature=xxx';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const event = createMockEvent('POST', {
        fileName: 'test-image.jpg',
        contentType: 'image/jpeg',
        fileSize: 1024000,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.upload).toBeDefined();
      expect(body.upload.url).toBe(mockUrl);
      expect(body.upload.key).toContain('test-user-123');
      expect(body.upload.bucket).toBe(process.env.BUCKET_NAME);
      expect(body.upload.method).toBe('PUT');
      expect(body.upload.headers['Content-Type']).toBe('image/jpeg');
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    test('should generate presigned URL for PDF upload', async () => {
      const mockUrl = 'https://s3.amazonaws.com/test-bucket/test.pdf?signature=xxx';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const event = createMockEvent('POST', {
        fileName: 'document.pdf',
        contentType: 'application/pdf',
        fileSize: 5000000,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.upload.key).toContain('.pdf');
    });

    test('should reject request without fileName', async () => {
      const event = createMockEvent('POST', {
        contentType: 'image/jpeg',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('fileName');
      expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    test('should reject request without contentType', async () => {
      const event = createMockEvent('POST', {
        fileName: 'test.jpg',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('contentType');
    });

    test('should reject disallowed content types', async () => {
      const event = createMockEvent('POST', {
        fileName: 'test.exe',
        contentType: 'application/x-msdownload',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('not allowed');
      expect(body.allowedTypes).toBeDefined();
    });

    test('should reject files exceeding size limit', async () => {
      const event = createMockEvent('POST', {
        fileName: 'huge-file.jpg',
        contentType: 'image/jpeg',
        fileSize: 20 * 1024 * 1024, // 20MB
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toContain('exceeds maximum');
      expect(body.maxSize).toBeDefined();
    });

    test('should reject request without authorization', async () => {
      const event = createMockEvent('POST', {
        fileName: 'test.jpg',
        contentType: 'image/jpeg',
      });
      delete event.requestContext.authorizer;

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    test('should sanitize file names with special characters', async () => {
      const mockUrl = 'https://s3.amazonaws.com/test-bucket/test-key?signature=xxx';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const event = createMockEvent('POST', {
        fileName: 'test file with spaces & special.jpg',
        contentType: 'image/jpeg',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.upload.key).toContain('test_file_with_spaces___special.jpg');
    });

    test('should include date in S3 key', async () => {
      const mockUrl = 'https://s3.amazonaws.com/test-bucket/test-key?signature=xxx';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const event = createMockEvent('POST', {
        fileName: 'test.jpg',
        contentType: 'image/jpeg',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      const datePattern = /\d{4}-\d{2}-\d{2}/;
      expect(body.upload.key).toMatch(datePattern);
    });

    test('should handle S3 errors gracefully', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('S3 service unavailable'));

      const event = createMockEvent('POST', {
        fileName: 'test.jpg',
        contentType: 'image/jpeg',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(body.error).toBe('InternalServerError');
    });

    test('should include metadata in presigned URL', async () => {
      const mockUrl = 'https://s3.amazonaws.com/test-bucket/test-key?signature=xxx';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const event = createMockEvent('POST', {
        fileName: 'document.pdf',
        contentType: 'application/pdf',
        fileSize: 1000000,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(body.upload.metadata).toBeDefined();
      expect(body.upload.metadata.userId).toBe('test-user-123');
      expect(body.upload.metadata.fileName).toBe('document.pdf');
      expect(body.upload.metadata.contentType).toBe('application/pdf');
      expect(body.upload.metadata.fileSize).toBe(1000000);
    });
  });

  describe('OPTIONS /uploads/presign', () => {
    test('should handle CORS preflight', async () => {
      const event = createMockEvent('OPTIONS');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.message).toBe('OK');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('Unsupported methods', () => {
    test('should reject unsupported HTTP methods', async () => {
      const event = createMockEvent('GET');

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(405);
      expect(body.error).toBe('MethodNotAllowed');
    });
  });
});
