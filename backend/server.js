const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const datasetRoutes = require('./routes/datasets');
const uploadRoutes = require('./routes/upload');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const downloadRoutes = require('./routes/download');
const aiRoutes = require('./ai-routes');
const { getStore } = require('./services/store');
const { resolveSecret } = require('./services/jwt');

const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false);

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((s) => s.trim());
  app.use(cors({ origin: allowedOrigins, credentials: true }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  // NOTE: uploaded files are intentionally NOT served statically. They are only available through
  // the authenticated, ownership-checked GET /api/download/:id.
  app.use('/api/datasets', datasetRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/download', downloadRoutes);
  app.use('/api/ai', aiRoutes);

  app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 10MB limit' : 'Invalid upload';
      return res.status(status).json({ success: false, error: message });
    }
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: 'Invalid JSON body' });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: 'Request body too large' });
    }
    console.error(err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  });

  app.use((req, res) => res.status(404).json({ success: false, error: 'Route not found' }));
  return app;
}

function assertConfiguration() {
  resolveSecret(); // throws in production if JWT_SECRET is missing/weak
  getStore(); // throws in production if Supabase is not configured
  if (!process.env.AI_SERVICE_TOKEN) {
    const msg = 'AI_SERVICE_TOKEN is not set: calls to the AI service will be rejected. Set the same value on both services.';
    if (isProd) throw new Error(msg);
    console.warn(`⚠️  ${msg}`);
  }
}

const app = createApp();

if (require.main === module) {
  assertConfiguration();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Allowed frontend origin(s): ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
