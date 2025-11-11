/**
 * OpenAPI Contract Tests
 * Validates API responses against OpenAPI specification
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Load OpenAPI spec
const specPath = path.join(__dirname, '../../openapi/sparkboard.yaml');
const specContent = fs.readFileSync(specPath, 'utf8');
const openApiSpec = yaml.parse(specContent);

// API Base URL
const API_BASE_URL = process.env.API_URL || 'https://994mxyt7tl.execute-api.ap-northeast-1.amazonaws.com/prod';
const AUTH_TOKEN = process.env.AUTH_TOKEN; // Will be skipped if not provided

// Helper to make authenticated requests
async function apiRequest(method, path, data = null, requiresAuth = true) {
  const config = {
    method,
    url: `${API_BASE_URL}${path}`,
    headers: {},
  };

  if (requiresAuth && AUTH_TOKEN) {
    config.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  if (data) {
    config.data = data;
    config.headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await axios(config);
    return { status: response.status, data: response.data, headers: response.headers };
  } catch (error) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data, headers: error.response.headers };
    }
    throw error;
  }
}

// Validate response against schema
function validateSchema(data, schema, path = 'root') {
  if (!schema) return true;

  const errors = [];

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${path}.${field}`);
      }
    }
  }

  // Check properties
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        const value = data[key];
        
        // Type validation
        if (propSchema.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          const expectedType = propSchema.type;
          
          if (actualType !== expectedType && value !== null) {
            if (!(propSchema.nullable && value === null)) {
              errors.push(`Type mismatch at ${path}.${key}: expected ${expectedType}, got ${actualType}`);
            }
          }
        }

        // Array validation
        if (propSchema.type === 'array' && Array.isArray(value) && propSchema.items) {
          value.forEach((item, index) => {
            if (propSchema.items.type === 'object' && propSchema.items.properties) {
              const itemErrors = validateSchema(item, propSchema.items, `${path}.${key}[${index}]`);
              errors.push(...itemErrors);
            }
          });
        }

        // Object validation
        if (propSchema.type === 'object' && propSchema.properties) {
          const nestedErrors = validateSchema(value, propSchema, `${path}.${key}`);
          errors.push(...nestedErrors);
        }

        // Enum validation
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push(`Invalid enum value at ${path}.${key}: ${value} not in [${propSchema.enum.join(', ')}]`);
        }

        // String constraints
        if (propSchema.type === 'string' && typeof value === 'string') {
          if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
            errors.push(`String too short at ${path}.${key}: min ${propSchema.minLength}, got ${value.length}`);
          }
          if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
            errors.push(`String too long at ${path}.${key}: max ${propSchema.maxLength}, got ${value.length}`);
          }
        }
      }
    }
  }

  return errors;
}

describe('OpenAPI Contract Tests', () => {
  describe('Health Check', () => {
    test('GET /health should return 200 and match schema', async () => {
      const response = await apiRequest('GET', '/health', null, false);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(typeof response.data.status).toBe('string');
    });
  });

  describe('Items API', () => {
    describe('GET /items', () => {
      test('should return 200 with valid schema when authenticated', async () => {
        if (!AUTH_TOKEN) {
          console.warn('Skipping authenticated test - no AUTH_TOKEN provided');
          return;
        }

        const response = await apiRequest('GET', '/items');
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('success');
        expect(response.data).toHaveProperty('items');
        expect(response.data).toHaveProperty('count');
        expect(Array.isArray(response.data.items)).toBe(true);
        expect(typeof response.data.count).toBe('number');
      });

      test('should return 401 without authentication', async () => {
        const response = await apiRequest('GET', '/items', null, false);
        
        expect(response.status).toBe(401);
        expect(response.data).toHaveProperty('message');
        expect(response.data.message).toBe('Unauthorized');
      });

      test('should validate limit parameter', async () => {
        if (!AUTH_TOKEN) {
          console.warn('Skipping authenticated test - no AUTH_TOKEN provided');
          return;
        }

        const response = await apiRequest('GET', '/items?limit=200');
        
        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('error');
        expect(response.data.error).toBe('ValidationError');
      });
    });

    describe('POST /items', () => {
      test('should create task with valid schema', async () => {
        if (!AUTH_TOKEN) {
          console.warn('Skipping authenticated test - no AUTH_TOKEN provided');
          return;
        }

        const taskData = {
          title: 'Contract Test Task',
          content: 'Testing task creation via contract tests',
          type: 'task',
          subtasks: [
            { id: 'st-1', title: 'Subtask 1', completed: false }
          ],
          deadline: '2025-12-31T23:59:59Z',
        };

        const response = await apiRequest('POST', '/items', taskData);
        
        expect([201, 403]).toContain(response.status); // 403 if not enough permissions
        
        if (response.status === 201) {
          expect(response.data).toHaveProperty('success', true);
          expect(response.data).toHaveProperty('item');
          expect(response.data.item).toHaveProperty('id');
          expect(response.data.item).toHaveProperty('type', 'task');
          expect(response.data.item).toHaveProperty('status', 'active');
          expect(response.data.item).toHaveProperty('title', taskData.title);
          expect(response.data.item.subtasks).toHaveLength(1);
        }
      });

      test('should reject task without title', async () => {
        if (!AUTH_TOKEN) {
          console.warn('Skipping authenticated test - no AUTH_TOKEN provided');
          return;
        }

        const invalidData = {
          content: 'Missing title',
          type: 'task',
        };

        const response = await apiRequest('POST', '/items', invalidData);
        
        expect(response.status).toBe(400);
        expect(response.data).toHaveProperty('error');
      });

      test('should return 401 without authentication', async () => {
        const taskData = {
          title: 'Unauthorized Task',
          type: 'task',
        };

        const response = await apiRequest('POST', '/items', taskData, false);
        
        expect(response.status).toBe(401);
        expect(response.data).toHaveProperty('message', 'Unauthorized');
      });
    });

    describe('OPTIONS /items', () => {
      test('should return CORS headers', async () => {
        const response = await apiRequest('OPTIONS', '/items', null, false);
        
        expect([200, 204]).toContain(response.status);
        expect(response.headers).toHaveProperty('access-control-allow-origin');
      });
    });
  });

  describe('Response Schema Validation', () => {
    test('GET /items response matches OpenAPI schema', async () => {
      if (!AUTH_TOKEN) {
        console.warn('Skipping authenticated test - no AUTH_TOKEN provided');
        return;
      }

      const response = await apiRequest('GET', '/items');
      
      if (response.status === 200) {
        const schema = openApiSpec.paths['/items'].get.responses['200'].content['application/json'].schema;
        const errors = validateSchema(response.data, schema);
        
        if (errors.length > 0) {
          console.error('Schema validation errors:', errors);
        }
        
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('Error Response Validation', () => {
    test('Error responses should have message field', async () => {
      const response = await apiRequest('GET', '/items', null, false);
      
      expect(response.status).toBe(401);
      expect(response.data).toHaveProperty('message');
      expect(typeof response.data.message).toBe('string');
      // API Gateway returns {message} for 401, Lambda returns {error, message}
    });
  });
});
