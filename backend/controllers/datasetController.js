const fs = require('node:fs');
const { getStore, isUuid } = require('../services/store');
const ai = require('../services/aiClient');
const { storedFilePath } = require('./uploadController');

// Fields returned to the browser (never the physical table name or internal file path).
const toPublic = (d) => ({
  id: d.id,
  name: d.name,
  file_size: d.file_size,
  mime_type: d.mime_type,
  created_at: d.created_at,
  row_count: d.row_count ?? (d.profile && d.profile.row_count) ?? null,
  column_count: d.column_count ?? (d.profile && d.profile.column_count) ?? null,
  columns: d.profile ? d.profile.columns : undefined,
  numeric_columns: d.profile ? d.profile.numeric_columns : undefined,
  categorical_columns: d.profile ? d.profile.categorical_columns : undefined,
  date_columns: d.profile ? d.profile.date_columns : undefined,
  preview_rows: d.profile ? d.profile.preview_rows : undefined,
  basic_statistics: d.profile ? d.profile.basic_statistics : undefined,
});

// GET /api/datasets
const getAllDatasets = async (req, res) => {
  try {
    const rows = await getStore().datasets.list(req.user.userId);
    // The list view does not need the full profile.
    res.json({ success: true, data: rows.map((d) => ({ ...toPublic(d), columns: undefined, preview_rows: undefined, basic_statistics: undefined })) });
  } catch (error) {
    console.error('List datasets error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch datasets' });
  }
};

// GET /api/datasets/:id
const getDatasetById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ success: false, error: 'Dataset not found' });
    const dataset = await getStore().datasets.get(id, req.user.userId);
    if (!dataset) return res.status(404).json({ success: false, error: 'Dataset not found' });
    res.json({ success: true, data: toPublic(dataset) });
  } catch (error) {
    console.error('Get dataset error:', error.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// DELETE /api/datasets/:id  - removes metadata, the stored file and the dataset's database table
const deleteDataset = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ success: false, error: 'Dataset not found' });
    const removed = await getStore().datasets.remove(id, req.user.userId);
    if (!removed) return res.status(404).json({ success: false, error: 'Dataset not found' });

    fs.rmSync(storedFilePath(removed.id), { force: true });
    if (removed.table_name) {
      await ai.dropTable(removed.table_name).catch((e) => console.warn('Could not drop dataset table:', e.message));
    }
    res.json({ success: true, message: 'Dataset deleted successfully' });
  } catch (error) {
    console.error('Delete dataset error:', error.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

module.exports = { getAllDatasets, getDatasetById, deleteDataset, toPublic };
