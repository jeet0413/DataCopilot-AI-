const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const router = express.Router();

// AI Service Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper function to call AI service
async function callAIService(endpoint, data = null, file = null) {
  try {
    let config = {
      method: 'POST',
      url: `${AI_SERVICE_URL}${endpoint}`,
    };

    if (file) {
      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
      config.data = formData;
      config.headers = formData.getHeaders();
    } else if (data) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('AI Service Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'AI service unavailable');
  }
}

// Route: Analyze uploaded CSV file
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Analyzing file:', req.file.originalname);

    // Call AI service to process the CSV
    const analysis = await callAIService('/process-data', null, req.file);

    res.json({
      success: true,
      data: analysis,
      message: 'File analyzed successfully'
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze file',
      details: error.message 
    });
  }
});

// Route: Process natural language query
router.post('/query', async (req, res) => {
  try {
    const { user_query, table_name, user_id } = req.body;

    if (!user_query || !table_name || !user_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: user_query, table_name, user_id' 
      });
    }

    console.log(`Processing query: "${user_query}" for table: ${table_name}`);

    // Call AI service to process the query
    const result = await callAIService('/query', {
      user_query,
      table_name,
      user_id
    });

    res.json({
      success: true,
      data: result,
      message: 'Query processed successfully'
    });
  } catch (error) {
    console.error('Query processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process query',
      details: error.message 
    });
  }
});

// Route: Generate insights
router.post('/insights', async (req, res) => {
  try {
    const { table_name, user_id, query_results } = req.body;

    if (!table_name || !user_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: table_name, user_id' 
      });
    }

    console.log(`Generating insights for table: ${table_name}`);

    // Call AI service to generate insights
    const insights = await callAIService('/generate-insights', {
      table_name,
      user_id,
      query_results
    });

    res.json({
      success: true,
      data: insights,
      message: 'Insights generated successfully'
    });
  } catch (error) {
    console.error('Insights generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate insights',
      details: error.message 
    });
  }
});

// Route: Generate business recommendations
router.post('/recommendations', async (req, res) => {
  try {
    const { insights, business_context } = req.body;

    if (!insights) {
      return res.status(400).json({ 
        error: 'Missing required field: insights' 
      });
    }

    console.log('Generating business recommendations');

    // Call AI service to generate recommendations
    const recommendations = await callAIService('/recommendations', {
      insights,
      business_context
    });

    res.json({
      success: true,
      data: recommendations,
      message: 'Recommendations generated successfully'
    });
  } catch (error) {
    console.error('Recommendations generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      details: error.message 
    });
  }
});

// Route: Health check for AI service
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/`);
    res.json({
      success: true,
      ai_service_status: 'healthy',
      ai_service_response: response.data
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      ai_service_status: 'unhealthy',
      error: 'AI service is not accessible'
    });
  }
});

// Route: Get AI service capabilities
router.get('/capabilities', async (req, res) => {
  try {
    const capabilities = {
      supported_operations: [
        'csv_analysis',
        'natural_language_to_sql',
        'insight_generation',
        'recommendation_engine'
      ],
      supported_file_types: ['csv'],
      query_types: [
        'count_queries',
        'aggregation_queries',
        'trend_analysis',
        'data_quality_checks'
      ],
      ai_features: [
        'column_detection',
        'data_type_inference',
        'missing_value_analysis',
        'basic_statistics',
        'outlier_detection',
        'trend_detection',
        'business_recommendations'
      ]
    };

    res.json({
      success: true,
      data: capabilities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get capabilities'
    });
  }
});

module.exports = router;
