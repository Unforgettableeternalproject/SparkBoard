/**
 * Uploads Lambda Handler
 * POST /uploads/presign - Generate presigned URL for S3 file upload
 * Requires Cognito JWT token in Authorization header
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const getBucketName = () => process.env.BUCKET_NAME;
const PRESIGN_EXPIRATION = 300; // 5 minutes

// Allowed file types and sizes
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Helper function to create API response
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
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
  };
}

/**
 * Get file extension from content type
 */
function getFileExtension(contentType) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
    'text/csv': 'csv',
  };
  
  return extensions[contentType] || 'bin';
}

/**
 * POST /uploads/presign - Generate presigned URL
 */
async function generatePresignedUrl(event) {
  console.log('Generating presigned URL:', JSON.stringify(event, null, 2));

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

    // Validate request
    const { fileName, contentType, fileSize } = body;

    if (!fileName || typeof fileName !== 'string') {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'fileName is required and must be a string',
      });
    }

    if (!contentType || typeof contentType !== 'string') {
      return createResponse(400, {
        error: 'ValidationError',
        message: 'contentType is required and must be a string',
      });
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return createResponse(400, {
        error: 'ValidationError',
        message: `Content type ${contentType} is not allowed`,
        allowedTypes: ALLOWED_CONTENT_TYPES,
      });
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return createResponse(400, {
        error: 'ValidationError',
        message: `File size ${fileSize} exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`,
        maxSize: MAX_FILE_SIZE,
      });
    }

    // Generate unique file key
    // Structure: userId/YYYY-MM-DD/uuid-filename.ext
    const date = new Date().toISOString().split('T')[0];
    const fileId = uuidv4();
    const extension = getFileExtension(contentType);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${user.userId}/${date}/${fileId}-${sanitizedFileName}`;

    // Create S3 PutObject command
    const bucketName = getBucketName();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      // Optional: Add metadata
      Metadata: {
        'uploaded-by': user.userId,
        'uploaded-at': new Date().toISOString(),
        'original-filename': fileName,
      },
    });

    // Generate presigned URL
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGN_EXPIRATION,
    });

    console.log(`Presigned URL generated for user ${user.userId}: ${key}`);

    return createResponse(200, {
      success: true,
      upload: {
        url: presignedUrl,
        key: key,
        bucket: bucketName,
        expiresIn: PRESIGN_EXPIRATION,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        metadata: {
          userId: user.userId,
          fileName: fileName,
          contentType: contentType,
          fileSize: fileSize || null,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return createResponse(500, {
      error: 'InternalServerError',
      message: 'Failed to generate presigned URL',
      details: error.message,
    });
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Uploads handler invoked:', {
    httpMethod: event.httpMethod,
    path: event.path,
    resource: event.resource,
  });

  const httpMethod = event.httpMethod;

  try {
    switch (httpMethod) {
      case 'POST':
        return await generatePresignedUrl(event);
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
