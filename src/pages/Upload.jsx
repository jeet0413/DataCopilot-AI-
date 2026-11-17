import React, { useState, useRef } from 'react';
import { Upload as UploadIcon, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { uploadDataset } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Upload = () => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [uploadResults, setUploadResults] = useState({});
  const [processingFiles, setProcessingFiles] = useState(new Set());
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList).filter(file => {
      // Check file type and extension
      const isValidType = file.type === 'text/csv' || file.name.endsWith('.csv');
      // Check file size (must be greater than 0)
      const isValidSize = file.size > 0;
      return isValidType && isValidSize;
    });
    
    if (newFiles.length === 0) {
      alert('Please select valid CSV files with data');
      return;
    }
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Start real upload process
    newFiles.forEach(file => {
      setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }));
      setUploadErrors(prev => { const next = { ...prev }; delete next[file.name]; return next; });
      uploadFile(file);
    });
  };

  const uploadFile = async (file) => {
    setProcessingFiles(prev => new Set(prev).add(file.name));
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const currentProgress = prev[file.name] || 0;
          const newProgress = Math.min(currentProgress + Math.random() * 20, 90);
          return { ...prev, [file.name]: newProgress };
        });
      }, 200);

      const response = await uploadDataset(file);
      
      clearInterval(progressInterval);
      
      if (response.success) {
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        setUploadResults(prev => ({ ...prev, [file.name]: response.data }));
        setUploadStatus(prev => ({ ...prev, [file.name]: 'completed' }));
        
        // Redirect to dashboard after successful upload
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
      setUploadErrors(prev => ({ ...prev, [file.name]: error.message || 'Upload failed' }));
    } finally {
      setProcessingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.name);
        return newSet;
      });
    }
  };

  const removeFile = (fileName) => {
    setFiles(prev => prev.filter(file => file.name !== fileName));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
    setUploadStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[fileName];
      return newStatus;
    });
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Real preview rows returned by the server after the file was analysed.
  const getFilePreview = (file) => {
    const result = uploadResults[file.name];
    return result && Array.isArray(result.preview_rows) ? result.preview_rows.slice(0, 3) : [];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Upload Data
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Upload your CSV files to start analyzing with AI
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`card p-8 border-2 border-dashed transition-colors duration-200 ${
          dragActive
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Drop your CSV files here
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            or click to browse from your computer
          </p>
          <button
            onClick={openFileDialog}
            className="btn-primary"
          >
            Select Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv"
            onChange={handleChange}
            className="hidden"
          />
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Uploading Files ({files.length})
          </h2>
          
          {files.map((file) => {
            const progress = uploadProgress[file.name] || 0;
            const status = uploadStatus[file.name] || 'pending';
            const isProcessing = processingFiles.has(file.name);
            const previewData = getFilePreview(file);
            
            return (
              <div key={file.name} className="card p-6 hover:shadow-md transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <FileText className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {file.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-green-500 animate-fade-in" />
                    )}
                    {status === 'uploading' && isProcessing && (
                      <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    )}
                    {status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <button
                      onClick={() => removeFile(file.name)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                    >
                      <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {status === 'uploading' && isProcessing && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                      <span className="text-gray-600 dark:text-gray-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Loading Skeleton */}
                {status === 'uploading' && isProcessing && progress < 50 && (
                  <div className="mb-4">
                    <SkeletonLoader type="table" className="opacity-50" />
                  </div>
                )}

                {status === 'error' && uploadErrors[file.name] && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {uploadErrors[file.name]}
                  </p>
                )}

                {/* Preview Table */}
                {status === 'completed' && previewData.length > 0 && (
                  <div className="mt-4 animate-fade-in">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Preview (first 3 rows) - {uploadResults[file.name].row_count} rows, {uploadResults[file.name].column_count} columns
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            {Object.keys(previewData[0]).map((key) => (
                              <th
                                key={key}
                                className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, index) => (
                            <tr
                              key={`row-${index}`}
                              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
                            >
                              {Object.values(row).map((value, cellIndex) => (
                                <td
                                  key={`cell-${index}-${cellIndex}`}
                                  className="py-2 px-3 text-gray-600 dark:text-gray-400"
                                >
                                  {value === null || value === undefined ? '' : String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 && (
        <EmptyState 
          type="upload"
          onAction={openFileDialog}
        />
      )}
    </div>
  );
};

export default Upload;
