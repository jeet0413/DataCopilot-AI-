const getHealth = async (req, res) => {
  try {
    const database = require('../services/supabase-fallback');
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: database.isUsingMock() ? 'mock' : 'supabase',
      supabase: !database.isUsingMock(),
      mode: database.isUsingMock() ? 'development' : 'production',
      supabaseUrl: process.env.SUPABASE_URL ? 'configured' : 'not configured'
    };

    res.json({
      success: true,
      data: healthData
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
};

module.exports = {
  getHealth
};
