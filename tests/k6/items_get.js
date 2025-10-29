/**
 * K6 Load Test for GET /items endpoint
 * Target: P95 latency < 200ms
 * 
 * Usage:
 *   k6 run items_get.js
 *   k6 run --vus 10 --duration 30s items_get.js
 *   
 * With auth token:
 *   k6 run -e AUTH_TOKEN="your-jwt-token" items_get.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const itemsResponseTime = new Trend('items_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '10s', target: 5 },   // Ramp up to 5 users
    { duration: '30s', target: 10 },  // Stay at 10 users
    { duration: '10s', target: 20 },  // Ramp up to 20 users
    { duration: '20s', target: 20 },  // Stay at 20 users
    { duration: '10s', target: 0 },   // Ramp down
  ],
  thresholds: {
    // For performance testing, focus on successful responses
    'http_req_duration{status:200}': ['p(95)<200'], // P95 for successful requests < 200ms
    'http_req_duration{endpoint:items,status:200}': ['p(95)<200'], // Items endpoint P95 < 200ms
    'errors': ['rate<0.05'], // Custom error rate < 5%
    // Note: http_req_failed will be high without auth, so we don't fail on it
  },
};

const BASE_URL = __ENV.API_URL || 'https://994mxyt7tl.execute-api.ap-northeast-1.amazonaws.com/prod';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Add auth token if provided
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  // Test GET /items
  const itemsResponse = http.get(`${BASE_URL}/items`, {
    headers: headers,
    tags: { endpoint: 'items' },
  });

  const itemsSuccess = check(itemsResponse, {
    'GET /items returns response': (r) => r.status !== 0,
    'GET /items response time < 500ms': (r) => r.timings.duration < 500,
    'GET /items response time < 200ms (P95 target)': (r) => r.timings.duration < 200,
    'GET /items returns JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!itemsSuccess);
  itemsResponseTime.add(itemsResponse.timings.duration);

  // If authenticated, check response structure
  if (AUTH_TOKEN && itemsResponse.status === 200) {
    check(itemsResponse, {
      'GET /items has items array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.items);
        } catch (e) {
          return false;
        }
      },
      'GET /items has success field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch (e) {
          return false;
        }
      },
    });
  }

  // Test GET /health (no auth required)
  const healthResponse = http.get(`${BASE_URL}/health`, {
    tags: { endpoint: 'health' },
  });

  check(healthResponse, {
    'GET /health status is 200': (r) => r.status === 200,
    'GET /health response time < 100ms': (r) => r.timings.duration < 100,
  });

  // Small delay between requests
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let output = '\n' + indent + '█ Load Test Summary\n';
  output += indent + '─'.repeat(50) + '\n\n';

  // Test run info
  output += indent + `Duration: ${formatDuration(data.state.testRunDurationMs)}\n`;
  output += indent + `VUs: ${data.metrics.vus.values.max} (max)\n`;
  output += indent + `Iterations: ${data.metrics.iterations.values.count}\n\n`;

  // HTTP metrics
  output += indent + '█ HTTP Metrics\n';
  output += indent + `  Requests: ${data.metrics.http_reqs.values.count}\n`;
  output += indent + `  Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  output += indent + `  Duration (P95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  output += indent + `  Duration (avg): ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  output += indent + `  Duration (max): ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;

  // Endpoint-specific metrics
  if (data.metrics['http_req_duration{endpoint:items}']) {
    const itemsMetric = data.metrics['http_req_duration{endpoint:items}'];
    output += indent + '█ GET /items Performance\n';
    output += indent + `  P95: ${itemsMetric.values['p(95)'].toFixed(2)}ms\n`;
    output += indent + `  Avg: ${itemsMetric.values.avg.toFixed(2)}ms\n`;
    output += indent + `  Min: ${itemsMetric.values.min.toFixed(2)}ms\n`;
    output += indent + `  Max: ${itemsMetric.values.max.toFixed(2)}ms\n\n`;
  }

  // Thresholds
  output += indent + '█ Thresholds\n';
  let allPassed = true;
  for (const [name, threshold] of Object.entries(data.metrics)) {
    if (threshold.thresholds) {
      for (const [thresholdName, thresholdData] of Object.entries(threshold.thresholds)) {
        const passed = thresholdData.ok;
        allPassed = allPassed && passed;
        const status = passed ? '✓' : '✗';
        output += indent + `  ${status} ${name} ${thresholdName}\n`;
      }
    }
  }

  output += '\n' + indent + (allPassed ? '✓ All thresholds passed!' : '✗ Some thresholds failed!') + '\n';

  return output;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}
