const database = require('../services/supabase-fallback');
const mockDatabase = require('../services/database');
const fs = require('node:fs');
const path = require('node:path');
const { authenticateToken } = require('../middleware/auth');

const uploadDataset = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = req.file;
    const { originalname, filename, size, mimetype } = file;

    // Check if file is empty
    if (size === 0) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        error: 'File is empty or has no data'
      });
    }

    // Validate file type (only CSV files)
    if (mimetype !== 'text/csv' && !originalname.endsWith('.csv')) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        error: 'Only CSV files are allowed'
      });
    }

    // Save metadata to database
    const datasetData = {
      name: originalname,
      file_path: `/uploads/${filename}`,
      file_size: size,
      mime_type: mimetype,
      user_id: userId,
      created_at: new Date().toISOString()
    };

    let data;
    if (database.isUsingMock()) {
      data = await mockDatabase.insertDataset(datasetData);
    } else {
      const { data: supabaseData, error } = await database.from('datasets').insert([datasetData]).select().single();
      if (error) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        throw error;
      }
      data = supabaseData;
    }

    res.status(201).json({
      success: true,
      data: {
        id: data.id,
        name: data.name,
        file_path: data.file_path,
        file_size: data.file_size,
        created_at: data.created_at
      },
      message: 'Dataset uploaded successfully'
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Upload failed'
    });
  }
};

module.exports = {
  uploadDataset
};
