// Mock API service for DataCopilot AI
// In a real application, this would connect to your backend API

// Simulate network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data
const mockDatasets = [
  {
    id: 1,
    name: 'Sales Q4 2023',
    rows: 15420,
    columns: 12,
    lastUpdated: '2 hours ago',
    size: '2.4 MB',
    trend: 23,
    status: 'active'
  },
  {
    id: 2,
    name: 'Customer Analytics',
    rows: 8934,
    columns: 18,
    lastUpdated: '1 day ago',
    size: '1.8 MB',
    trend: 12,
    status: 'active'
  },
  {
    id: 3,
    name: 'Product Inventory',
    rows: 567,
    columns: 8,
    lastUpdated: '3 days ago',
    size: '0.5 MB',
    trend: -5,
    status: 'active'
  },
  {
    id: 4,
    name: 'Marketing Campaigns',
    rows: 3456,
    columns: 15,
    lastUpdated: '1 week ago',
    size: '1.2 MB',
    trend: 8,
    status: 'active'
  }
];

const mockInsights = [
  {
    id: 1,
    title: 'Sales Spike Detected',
    description: 'Electronics category shows 45% increase in weekly sales',
    time: '2 hours ago',
    type: 'success',
    priority: 'high'
  },
  {
    id: 2,
    title: 'Customer Churn Alert',
    description: '15% increase in customer churn rate this month',
    time: '5 hours ago',
    type: 'warning',
    priority: 'medium'
  },
  {
    id: 3,
    title: 'Inventory Optimization',
    description: 'AI suggests reducing stock for low-performing products',
    time: '1 day ago',
    type: 'info',
    priority: 'low'
  }
];

// API functions
export const api = {
  // Dataset operations
  getDatasets: async () => {
    await delay(500);
    return { success: true, data: mockDatasets };
  },

  uploadDataset: async (file) => {
    await delay(1000);
    const newDataset = {
      id: Date.now(),
      name: file.name,
      rows: Math.floor(Math.random() * 10000) + 1000,
      columns: Math.floor(Math.random() * 20) + 5,
      lastUpdated: 'Just now',
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      trend: Math.floor(Math.random() * 30) - 10,
      status: 'processing'
    };
    return { success: true, data: newDataset };
  },

  deleteDataset: async (datasetId) => {
    await delay(300);
    return { success: true, message: 'Dataset deleted successfully' };
  },

  // Query operations
  queryData: async (query, datasetId) => {
    await delay(1500);
    
    const responses = [
      {
        text: 'Based on your sales data, I can see that revenue has increased by 23% over the last quarter. The top performing product category is Electronics with $45,000 in sales.',
        chart: {
          type: 'bar',
          data: [
            { name: 'Electronics', value: 45000 },
            { name: 'Clothing', value: 32000 },
            { name: 'Home', value: 28000 },
            { name: 'Sports', value: 15000 }
          ]
        },
        insights: [
          'Electronics category leading with 45% of total sales',
          'Overall growth trend positive across all categories',
          'Recommend increasing inventory for top performers'
        ]
      },
      {
        text: 'Your customer retention rate is currently 87%, which is above the industry average of 75%. However, there\'s been a 5% decrease in the last month.',
        chart: {
          type: 'line',
          data: [
            { name: 'Jan', value: 85 },
            { name: 'Feb', value: 87 },
            { name: 'Mar', value: 89 },
            { name: 'Apr', value: 88 },
            { name: 'May', value: 87 },
            { name: 'Jun', value: 82 }
          ]
        },
        insights: [
          'Retention rate peaked in March at 89%',
          'Recent decline requires attention',
          'Consider implementing customer loyalty programs'
        ]
      }
    ];

    return {
      success: true,
      data: responses[Math.floor(Math.random() * responses.length)]
    };
  },

  // Insights operations
  getInsights: async () => {
    await delay(400);
    return { success: true, data: mockInsights };
  },

  generateInsights: async (datasetId) => {
    await delay(2000);
    return {
      success: true,
      data: {
        kpis: [
          { metric: 'Revenue Growth', value: '+23%', trend: 'up' },
          { metric: 'Customer Satisfaction', value: '4.5/5', trend: 'stable' },
          { metric: 'Conversion Rate', value: '3.8%', trend: 'down' }
        ],
        recommendations: [
          'Focus on retaining customers in the South region',
          'Expand Electronics category inventory',
          'Implement conversion rate optimization'
        ]
      }
    };
  },

  // Analytics operations
  getAnalytics: async (timeframe = 'month') => {
    await delay(600);
    return {
      success: true,
      data: {
        revenue: [
          { name: 'Jan', value: 4000 },
          { name: 'Feb', value: 3000 },
          { name: 'Mar', value: 5000 },
          { name: 'Apr', value: 4500 },
          { name: 'May', value: 6000 },
          { name: 'Jun', value: 5500 }
        ],
        customers: [
          { name: 'Jan', value: 2400 },
          { name: 'Feb', value: 1398 },
          { name: 'Mar', value: 9800 },
          { name: 'Apr', value: 3908 },
          { name: 'May', value: 4800 },
          { name: 'Jun', value: 3800 }
        ]
      }
    };
  },

  // User operations
  getUserProfile: async () => {
    await delay(300);
    return {
      success: true,
      data: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        company: 'Acme Corporation',
        plan: 'Professional',
        joinedAt: '2023-01-15'
      }
    };
  },

  updateProfile: async (profileData) => {
    await delay(500);
    return { success: true, message: 'Profile updated successfully' };
  }
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

// Export wrapped API functions
export const wrappedApi = {
  getDatasets: (...args) => withErrorHandling(api.getDatasets, ...args),
  uploadDataset: (...args) => withErrorHandling(api.uploadDataset, ...args),
  deleteDataset: (...args) => withErrorHandling(api.deleteDataset, ...args),
  queryData: (...args) => withErrorHandling(api.queryData, ...args),
  getInsights: (...args) => withErrorHandling(api.getInsights, ...args),
  generateInsights: (...args) => withErrorHandling(api.generateInsights, ...args),
  getAnalytics: (...args) => withErrorHandling(api.getAnalytics, ...args),
  getUserProfile: (...args) => withErrorHandling(api.getUserProfile, ...args),
  updateProfile: (...args) => withErrorHandling(api.updateProfile, ...args)
};

export default wrappedApi;
