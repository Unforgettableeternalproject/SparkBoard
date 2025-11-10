/**
 * Permission helper utilities for Lambda functions
 */

/**
 * Extract user info and groups from Cognito authorizer
 */
function getUserFromEvent(event) {
  const authorizer = event.requestContext?.authorizer;
  if (!authorizer || !authorizer.claims) {
    return null;
  }

  const claims = authorizer.claims;
  const groups = claims['cognito:groups'] ? claims['cognito:groups'].split(',') : [];
  
  return {
    userId: claims.sub,
    username: claims['cognito:username'] || claims.username,
    email: claims.email,
    orgId: claims['custom:orgId'] || 'sparkboard-demo',
    groups,
    isAdmin: groups.includes('Admin'),
    isModerator: groups.includes('Moderators'),
  };
}

/**
 * Check if user has permission to perform an action
 */
function checkPermission(user, action, resource = null) {
  if (!user) return false;
  
  // Admin has all permissions
  if (user.isAdmin) return true;
  
  switch (action) {
    // Moderators can create announcements and tasks
    case 'create:announcement':
      return user.isModerator || user.isAdmin;
    
    case 'create:task':
      return true; // All authenticated users can create tasks
    
    // Owner, Moderators, or Admin can update tasks
    case 'update:task':
      if (!resource) return false;
      return resource.userId === user.userId || user.isModerator || user.isAdmin;
    
    // Owner, Moderators, or Admin can delete tasks
    case 'delete:task':
      if (!resource) return false;
      return resource.userId === user.userId || user.isModerator || user.isAdmin;
    
    // Only moderators/admins can delete announcements
    case 'delete:announcement':
      return user.isModerator || user.isAdmin;
    
    // Only moderators/admins can update announcements
    case 'update:announcement':
      return user.isModerator || user.isAdmin;
    
    default:
      return false;
  }
}

/**
 * Create standardized API response
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Create error response
 */
function createErrorResponse(statusCode, error, message, details = null) {
  const body = { error, message };
  if (details) body.details = details;
  return createResponse(statusCode, body);
}

module.exports = {
  getUserFromEvent,
  checkPermission,
  createResponse,
  createErrorResponse,
};
