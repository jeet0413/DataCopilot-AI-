const express = require('express');
const multer = require('multer');
const { uploadDataset } = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Files are held in memory (10MB cap), validated and ingested by the AI service, then written
// under a server-generated name; the client-supplied filename never touches the filesystem path.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// POST /api/upload - Upload a dataset file (protected)
router.post('/', authenticateToken, upload.single('file'), uploadDataset);

module.exports = router;
