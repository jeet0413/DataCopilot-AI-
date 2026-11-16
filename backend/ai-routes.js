const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('./middleware/auth');
const { rateLimit } = require('./middleware/rateLimit');
const { getStore, isUuid } = require('./services/store');
const ai = require('./services/aiClient');

const router = express.Router();

// Every AI route requires a logged-in user. Datasets are always resolved from the caller's own
// records: the browser sends a dataset_id, never a table name or user id.
router.use(authenticateToken);

// LLM calls are slow and cost money; cap them per user rather than per IP.
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_PER_MINUTE) || 30,
  keyFn: (req) => `ai:${req.user.userId}`,
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

function sendError(res, error, fallbackMessage) {
  if (error instanceof ai.AIServiceError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({ success: false, error: error.message });
  }
  console.error(`${fallbackMessage}:`, error.message);
  return res.status(500).json({ success: false, error: fallbackMessage });
}

async function loadOwnedDataset(req, res) {
  const datasetId = req.body && (req.body.dataset_id || req.body.datasetId);
  if (!isUuid(datasetId)) {
    res.status(400).json({ success: false, error: 'dataset_id is required' });
    return null;
  }
  const dataset = await getStore().datasets.get(datasetId, req.user.userId);
  if (!dataset || !dataset.table_name) {
    res.status(404).json({ success: false, error: 'Dataset not found' });
    return null;
  }
  return dataset;
}

// POST /api/ai/analyze - profile a CSV without saving it (preview before upload)
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const analysis = await ai.profileOnly(req.file.buffer, req.file.originalname);
    res.json({ success: true, data: analysis, message: 'File analyzed successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to analyze file');
  }
});

// POST /api/ai/query  { dataset_id, user_query }
router.post('/query', async (req, res) => {
  try {
    const userQuery = req.body && req.body.user_query;
    if (typeof userQuery !== 'string' || !userQuery.trim()) {
      return res.status(400).json({ success: false, error: 'user_query is required' });
    }
    if (userQuery.length > 1000) {
      return res.status(400).json({ success: false, error: 'Question is too long (max 1000 characters)' });
    }
    const dataset = await loadOwnedDataset(req, res);
    if (!dataset) return;

    const result = await ai.query({
      user_query: userQuery.trim(),
      table_name: dataset.table_name,
      user_id: req.user.userId,
      table_schema_text: dataset.profile && dataset.profile.schema_text,
    });
    // Do not leak the physical table name to the browser.
    const { schema_used, ...safe } = result;
    res.json({ success: true, data: { ...safe, dataset_id: dataset.id }, message: 'Query processed successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to process query');
  }
});

// POST /api/ai/insights  { dataset_id }
router.post('/insights', async (req, res) => {
  try {
    const dataset = await loadOwnedDataset(req, res);
    if (!dataset) return;
    const insights = await ai.insights({ table_name: dataset.table_name, user_id: req.user.userId });
    res.json({ success: true, data: insights, message: 'Insights generated successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to generate insights');
  }
});

// POST /api/ai/recommendations  { insights, business_context? }
router.post('/recommendations', async (req, res) => {
  try {
    const { insights, business_context } = req.body || {};
    if (!insights) return res.status(400).json({ success: false, error: 'insights is required' });
    const recommendations = await ai.recommendations({ insights, business_context });
    res.json({ success: true, data: recommendations, message: 'Recommendations generated successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to generate recommendations');
  }
});

// GET /api/ai/health
router.get('/health', async (req, res) => {
  try {
    const status = await ai.health();
    res.json({ success: true, ai_service_status: status.status, database: status.database, llm_configured: status.llm_configured });
  } catch (error) {
    res.status(503).json({ success: false, ai_service_status: 'unhealthy', error: 'AI service is not accessible' });
  }
});

router.get('/capabilities', (req, res) => {
  res.json({
    success: true,
    data: {
      supported_operations: ['csv_analysis', 'natural_language_to_sql', 'insight_generation', 'recommendation_engine'],
      supported_file_types: ['csv'],
      max_file_size_mb: 10,
    },
  });
});

module.exports = router;
