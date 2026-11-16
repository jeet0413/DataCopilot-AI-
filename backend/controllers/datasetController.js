const database = require('../services/supabase-fallback');
const mockDatabase = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

const getAllDatasets = async (req, res) => {
  try {
    const userId = req.user?.userId;
    let data;
    
    if (database.isUsingMock()) {
      data = await mockDatabase.getDatasets();
    } else {
      try {
        const { data: supabaseData, error } = await database.from('datasets')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = supabaseData;
      } catch (supabaseError) {
        console.warn('Supabase query failed, falling back to mock:', supabaseError.message);
        // Fallback to mock database
        data = await mockDatabase.getDatasets();
      }
    }
    
    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch datasets'
    });
  }
};

const getDatasetById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    let data;
    if (database.isUsingMock()) {
      data = await mockDatabase.getDatasetById(id);
    } else {
      try {
        const { data: supabaseData, error } = await database.from('datasets')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single();
        if (error) throw error;
        data = supabaseData;
      } catch (supabaseError) {
        console.warn('Supabase query failed, falling back to mock:', supabaseError.message);
        // Fallback to mock database
        data = await mockDatabase.getDatasetById(id);
      }
    }
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

const deleteDataset = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    let success;
    if (database.isUsingMock()) {
      success = await mockDatabase.deleteDataset(id);
    } else {
      try {
        const { error } = await database.from('datasets')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        success = !error;
        if (error) throw error;
      } catch (supabaseError) {
        console.warn('Supabase delete failed, falling back to mock:', supabaseError.message);
        // Fallback to mock database
        success = await mockDatabase.deleteDataset(id);
      }
    }
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    res.json({
      success: true,
      message: 'Dataset deleted successfully'
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

module.exports = {
  getAllDatasets,
  getDatasetById,
  deleteDataset
};
