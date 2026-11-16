const { getStore } = require('../services/store');

// Public liveness check: reveals nothing about configuration beyond the storage mode.
const getHealth = (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: getStore().mode,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Health check failed' });
  }
};

module.exports = { getHealth };
