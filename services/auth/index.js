/**
 * Auth Me Lambda Handler
 * GET /auth/me - Returns authenticated user information
 * Requires Cognito JWT token in Authorization header
 */

exports.handler = async (event) => {
  console.log('Auth me request:', JSON.stringify(event, null, 2));

  try {
    // Extract user info from Cognito authorizer context
    const requestContext = event.requestContext;
    const authorizer = requestContext.authorizer;

    if (!authorizer || !authorizer.claims) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'No valid authorization token provided',
        }),
      };
    }

    // Extract user claims from Cognito JWT
    const claims = authorizer.claims;
    
    const user = {
      userId: claims.sub,
      username: claims['cognito:username'] || claims.username,
      email: claims.email,
      emailVerified: claims.email_verified === 'true',
      name: claims.name || claims['cognito:username'],
      orgId: claims['custom:orgId'] || 'sparkboard-demo',
      authTime: claims.auth_time,
      tokenIssued: claims.iat,
      tokenExpires: claims.exp,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        user,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error processing auth/me request:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'InternalServerError',
        message: 'Failed to process authentication',
      }),
    };
  }
};
