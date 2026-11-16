const express = require('express');
const router = express.Router();
const { getAllDatasets, getDatasetById, deleteDataset } = require('../controllers/datasetController');
const { authenticateToken } = require('../middleware/auth');

// GET /api/datasets - Get all datasets (protected)
router.get('/', authenticateToken, getAllDatasets);

// GET /api/datasets/:id - Get dataset by ID (protected)
router.get('/:id', authenticateToken, getDatasetById);

// DELETE /api/datasets/:id - Delete dataset (protected)
router.delete('/:id', authenticateToken, deleteDataset);

module.exports = router;
