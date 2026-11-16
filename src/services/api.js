// Real API service for DataCopilot AI
// Connects to the Node.js backend

import { authenticatedFetch } from './auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002/api';

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// AI Service API calls
export const analyzeDataset = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/ai/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type header for FormData - browser sets it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Dataset analysis error:', error);
    throw error;
  }
};

export const processNaturalLanguageQuery = async (userQuery, tableName, userId) => {
  return apiCall('/ai/query', {
    method: 'POST',
    body: JSON.stringify({
      user_query: userQuery,
      table_name: tableName,
      user_id: userId,
    }),
  });
};

export const generateInsights = async (tableName, userId, queryResults = null) => {
  return apiCall('/ai/insights', {
    method: 'POST',
    body: JSON.stringify({
      table_name: tableName,
      user_id: userId,
      query_results: queryResults,
    }),
  });
};

export const generateRecommendations = async (insights, businessContext = null) => {
  return apiCall('/ai/recommendations', {
    method: 'POST',
    body: JSON.stringify({
      insights,
      business_context: businessContext,
    }),
  });
};

export const getAIServiceHealth = async () => {
  return apiCall('/ai/health');
};

export const getAIServiceCapabilities = async () => {
  return apiCall('/ai/capabilities');
};

// Dataset operations
export const fetchDatasets = async () => {
  const response = await authenticatedFetch(`${API_BASE_URL}/datasets`);
  return await response.json();
};

export const uploadDataset = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type header for FormData - browser sets it with boundary
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Upload Error:', error);
    throw error;
  }
};

export const deleteDataset = async (datasetId) => {
  const response = await authenticatedFetch(`${API_BASE_URL}/datasets/${datasetId}`, {
    method: 'DELETE',
  });
  return await response.json();
};

// Health check
export const checkHealth = async () => {
  return await apiCall('/health');
};

// Error handling wrapper
export const withErrorHandling = async (apiFunction, ...args) => {
  try {
    const result = await apiFunction(...args);
    return result;
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
};

// Export wrapped API functions for backward compatibility
export const wrappedApi = {
  getDatasets: (...args) => withErrorHandling(fetchDatasets, ...args),
  uploadDataset: (...args) => withErrorHandling(uploadDataset, ...args),
  deleteDataset: (...args) => withErrorHandling(deleteDataset, ...args),
  getHealth: (...args) => withErrorHandling(checkHealth, ...args),
};

const apiService = {
  fetchDatasets,
  uploadDataset,
  deleteDataset,
  checkHealth,
  wrappedApi
};

export default apiService;
