// In-memory database fallback for testing without Supabase
// This will store datasets in memory for demo purposes

let datasets = [];

const mockDatabase = {
  // Get all datasets
  async getDatasets() {
    return datasets;
  },

  // Insert a new dataset
  async insertDataset(datasetData) {
    const newDataset = {
      id: `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      ...datasetData
    };
    
    datasets.push(newDataset);
    return newDataset;
  },

  // Delete a dataset
  async deleteDataset(id) {
    const index = datasets.findIndex(dataset => dataset.id === id);
    if (index > -1) {
      datasets.splice(index, 1);
      return true;
    }
    return false;
  },

  // Get dataset by ID
  async getDatasetById(id) {
    return datasets.find(dataset => dataset.id === id);
  }
};

module.exports = mockDatabase;
