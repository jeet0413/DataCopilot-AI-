// Server-to-server client for the Python AI service.
// Sends the shared secret (AI_SERVICE_TOKEN) on every call and maps failures to AIServiceError.
const axios = require('axios');
const FormData = require('form-data');

class AIServiceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'AIServiceError';
    this.status = status;
  }
}

function baseURL() {
  return process.env.AI_SERVICE_URL || 'http://localhost:8001';
}

function detailToMessage(detail) {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d && d.msg ? `${(d.loc || []).slice(1).join('.')}: ${d.msg}` : String(d))).join('; ');
  }
  return JSON.stringify(detail);
}

async function call(config, timeout) {
  try {
    const response = await axios({
      baseURL: baseURL(),
      timeout,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      ...config,
      headers: { 'X-Internal-Token': process.env.AI_SERVICE_TOKEN || '', ...(config.headers || {}) },
    });
    return response.data;
  } catch (error) {
    if (!error.response) {
      throw new AIServiceError('AI service is unreachable. Make sure it is running and AI_SERVICE_URL is correct.', 503);
    }
    const { status, data } = error.response;
    const message = detailToMessage(data && data.detail) || 'AI service error';
    if (status === 401) {
      throw new AIServiceError('AI service rejected the backend credentials (check AI_SERVICE_TOKEN on both services).', 502);
    }
    if (status === 503) throw new AIServiceError(message, 503);
    if (status >= 400 && status < 500) throw new AIServiceError(message, status);
    throw new AIServiceError(message, 502);
  }
}

const ingest = (buffer, filename, datasetId) => {
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: 'text/csv' });
  form.append('dataset_id', datasetId);
  return call({ method: 'POST', url: '/ingest', data: form, headers: form.getHeaders() }, 120000);
};

const profileOnly = (buffer, filename) => {
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: 'text/csv' });
  return call({ method: 'POST', url: '/process-data', data: form, headers: form.getHeaders() }, 60000);
};

const query = (payload) => call({ method: 'POST', url: '/query', data: payload }, 300000);
const insights = (payload) => call({ method: 'POST', url: '/generate-insights', data: payload }, 180000);
const recommendations = (payload) => call({ method: 'POST', url: '/recommendations', data: payload }, 120000);
const dropTable = (tableName) => call({ method: 'DELETE', url: `/datasets/${encodeURIComponent(tableName)}` }, 30000);
const health = () => call({ method: 'GET', url: '/health' }, 5000);

module.exports = { AIServiceError, ingest, profileOnly, query, insights, recommendations, dropTable, health };
