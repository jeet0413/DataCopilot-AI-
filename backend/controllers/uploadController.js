const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getStore } = require('../services/store');
const ai = require('../services/aiClient');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const storedFilePath = (datasetId) => path.join(UPLOADS_DIR, `${datasetId}.csv`);

const sanitizeName = (name) =>
  path.basename(String(name || 'dataset.csv')).replace(/[^\w.\- ()]/g, '_').slice(0, 150) || 'dataset.csv';

// POST /api/upload  (multipart: file)
// 1. validate  2. AI service profiles the CSV and loads it into its own PostgreSQL table
// 3. save the original file  4. save metadata owned by the user. Any later failure rolls back earlier steps.
const uploadDataset = async (req, res) => {
  const userId = req.user && req.user.userId;
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });

  const name = sanitizeName(file.originalname);
  if (!name.toLowerCase().endsWith('.csv')) {
    return res.status(400).json({ success: false, error: 'Only CSV files are allowed' });
  }
  if (!file.size) {
    return res.status(400).json({ success: false, error: 'File is empty or has no data' });
  }

  const datasetId = crypto.randomUUID();
  let ingested = false;
  let profile;
  let savedFile = false;

  try {
    profile = await ai.ingest(file.buffer, name, datasetId);
    ingested = true;

    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(storedFilePath(datasetId), file.buffer);
    savedFile = true;

    const dataset = await getStore().datasets.create({
      id: datasetId,
      user_id: userId,
      name,
      file_path: `uploads/${datasetId}.csv`,
      file_size: file.size,
      mime_type: 'text/csv',
      table_name: profile.table_name,
      row_count: profile.row_count,
      column_count: profile.column_count,
      profile,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: dataset.id,
        name: dataset.name,
        file_size: dataset.file_size,
        created_at: dataset.created_at,
        row_count: profile.row_count,
        column_count: profile.column_count,
        columns: profile.columns,
        numeric_columns: profile.numeric_columns,
        categorical_columns: profile.categorical_columns,
        date_columns: profile.date_columns,
        preview_rows: profile.preview_rows,
        basic_statistics: profile.basic_statistics,
      },
      message: 'Dataset uploaded and analysed successfully',
    });
  } catch (error) {
    // Roll back partial work so failed uploads leave nothing behind.
    if (savedFile) fs.rmSync(storedFilePath(datasetId), { force: true });
    if (ingested && profile) await ai.dropTable(profile.table_name).catch((e) => console.warn('Rollback drop failed:', e.message));

    if (error instanceof ai.AIServiceError) {
      console.warn('Upload rejected by AI service:', error.message);
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return res.status(status).json({ success: false, error: error.message });
    }
    console.error('Upload error:', error.message);
    return res.status(500).json({ success: false, error: 'Upload failed' });
  }
};

module.exports = { uploadDataset, storedFilePath, UPLOADS_DIR };
