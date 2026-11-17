import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Database, Eye, Download, MoreVertical, Calendar, X } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002/api';

const DatasetCard = ({ dataset, onDelete }) => {
  const { name, file_path, file_size, created_at, id } = dataset;
  const [showActions, setShowActions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  // Handle view dataset
  const handleViewDataset = async () => {
    if (showPreview && previewData) {
      // If preview is already showing, just toggle it off
      setShowPreview(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch the dataset content from download endpoint
      const token = localStorage.getItem('authToken');
      const downloadUrl = `${API_BASE_URL}/download/${id}`;
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dataset');
      }
      
      // Get the CSV content as text
      const csvText = await response.text();
      
      // Parse CSV content
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0] ? lines[0].split(',').map(h => h.trim()) : [];
      const rows = lines.slice(1, 11).map(line => 
        line.split(',').map(cell => cell.trim())
      ); // Show first 10 rows
      
      // Set preview data
      setPreviewData({
        headers,
        rows,
        totalRows: lines.length - 1,
        filename: name,
        fileSize: formatFileSize(file_size)
      });
      
      // Show preview
      setShowPreview(true);
      
      console.log('Dataset preview loaded:', {
        headers: headers.length,
        rows: rows.length,
        totalRows: lines.length - 1
      });
      
    } catch (error) {
      console.error('Error viewing dataset:', error);
      alert('Failed to view dataset: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle download
  const handleDownload = async () => {
    try {
      console.log('Starting download for dataset:', { id, name, file_path });
      
      // Create a proper download URL
      const downloadUrl = `${API_BASE_URL}/download/${id}`;
      console.log('Download URL:', downloadUrl);
      
      // Get auth token
      const token = localStorage.getItem('authToken');
      console.log('Auth token:', token ? 'exists' : 'missing');
      
      // Fetch the file with authentication
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Download error response:', errorData);
        throw new Error(errorData.error || 'File not available');
      }
      
      // Get the blob and create download link
      const blob = await response.blob();
      console.log('Blob created, size:', blob.size);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      window.location.href = '/upload';
      link.download = name;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 100);
      
      console.log('Download completed successfully');
    } catch (error) {
      console.error('Error downloading dataset:', error);
      alert('Failed to download dataset: ' + error.message);
    }
  };

  return (
    <div 
      className="card p-6 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 animate-fade-in group cursor-pointer"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition-colors duration-200">
            <Database className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-200">
              {name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatFileSize(file_size)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {showActions && (
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleViewDataset();
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                title="View dataset"
              >
                <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleDownload();
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                title="Download dataset"
              >
                <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
                onDelete?.(id);
              }
            }}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
            title="Delete dataset"
          >
            <MoreVertical className="w-4 h-4 text-red-500 dark:text-red-400" />
          </button>
        </div>
      </div>

      <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
        CSV File
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <Calendar className="w-4 h-4" />
          <span>{formatDate(created_at)}</span>
        </div>
      </div>

      {/* Dataset Preview */}
      {showPreview && previewData && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Dataset Preview: {previewData.filename}
            </h4>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{previewData.totalRows} rows</span>
              <span>•</span>
              <span>{previewData.fileSize}</span>
              <button
                onClick={() => setShowPreview(false)}
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-gray-500 dark:text-gray-400">Loading dataset...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {previewData.headers.map((header) => (
                      <th
                        key={header}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {previewData.rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`cell-${cellIndex}`}
                          className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap"
                        >
                          {cell || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {previewData.totalRows > 10 && (
                <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Showing first 10 rows of {previewData.totalRows} total rows
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatasetCard;

DatasetCard.propTypes = {
  dataset: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    file_path: PropTypes.string.isRequired,
    file_size: PropTypes.number.isRequired,
    created_at: PropTypes.string.isRequired
  }).isRequired,
  onDelete: PropTypes.func
};
