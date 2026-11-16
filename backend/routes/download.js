const express = require('express');
const fs = require('node:fs');
const { authenticateToken } = require('../middleware/auth');
const { getStore, isUuid } = require('../services/store');
const { storedFilePath } = require('../controllers/uploadController');

const router = express.Router();

// GET /api/download/:id - Download one of the caller's own datasets (protected)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ success: false, error: 'Dataset not found' });

    const dataset = await getStore().datasets.get(id, req.user.userId);
    if (!dataset) return res.status(404).json({ success: false, error: 'Dataset not found' });

    // The path is derived from the validated dataset id only, never from stored or client text.
    const filePath = storedFilePath(dataset.id);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on server' });
    }

    const safeName = String(dataset.name).replace(/[^\w.\- ()]/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(filePath);
    stream.on('error', (error) => {
      console.error('File stream error:', error.message);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'File streaming failed' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({ success: false, error: 'Download failed' });
  }
});

module.exports = router;
