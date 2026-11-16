const express = require('express');
const router = express.Router();
const path = require('node:path');
const fs = require('node:fs');
const { authenticateToken } = require('../middleware/auth');
const database = require('../services/supabase-fallback');
const mockDatabase = require('../services/database');

// GET /api/download/:id - Download a dataset file (protected)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    console.log('Download request:', { id, userId });
    
    if (!id) {
      console.log('Missing dataset ID');
      return res.status(400).json({
        success: false,
        error: 'Dataset ID is required'
      });
    }

    let dataset;
    if (database.isUsingMock()) {
      // Get dataset from mock database
      console.log('Using mock database');
      dataset = await mockDatabase.getDatasetById(id);
    } else {
      // Get dataset from Supabase
      console.log('Using Supabase database');
      const { data, error } = await database.from('datasets')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId) // Ensure user can only download their own datasets
        .single();
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      dataset = data;
    }

    console.log('Dataset found:', dataset);

    if (!dataset) {
      console.log('Dataset not found');
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    // Construct file path - handle both relative and absolute paths
    let filePath;
    if (dataset.file_path.startsWith('/uploads/')) {
      // Path is already relative to uploads
      filePath = path.join(__dirname, '..', dataset.file_path);
    } else if (dataset.file_path.startsWith('uploads/')) {
      // Path is relative but missing leading slash
      filePath = path.join(__dirname, '..', dataset.file_path);
    } else {
      // Assume it's just the filename
      filePath = path.join(__dirname, '..', 'uploads', path.basename(dataset.file_path));
    }
    
    console.log('File path:', filePath);
    console.log('Checking if file exists...');
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('File does not exist at path:', filePath);
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }
    
    console.log('File exists, starting download...');

    // Set appropriate headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${dataset.name}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    // Stream the file to the client
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'File streaming failed'
        });
      }
    });
    
    fileStream.on('end', () => {
      console.log('File streaming completed');
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: 'Download failed: ' + error.message
    });
  }
});

module.exports = router;
