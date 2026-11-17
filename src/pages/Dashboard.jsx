import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Database, TrendingUp, Users, DollarSign } from 'lucide-react';
import DatasetCard from '../components/DatasetCard';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { fetchDatasets, deleteDataset } from '../services/api';

const formatCount = (n) => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / Math.pow(1024, i)) * 10) / 10} ${units[i]}`;
};

// All figures are computed from the user's real datasets.
const buildStats = (datasets) => [
  { title: 'Total Datasets', value: String(datasets.length), icon: Database },
  { title: 'Total Rows', value: formatCount(datasets.reduce((n, d) => n + (d.row_count || 0), 0)), icon: TrendingUp },
  { title: 'Total Columns', value: formatCount(datasets.reduce((n, d) => n + (d.column_count || 0), 0)), icon: Users },
  { title: 'Storage Used', value: formatBytes(datasets.reduce((n, d) => n + (d.file_size || 0), 0)), icon: DollarSign },
];

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await fetchDatasets();
        if (response.success) {
          setDatasets(response.data);
        } else {
          console.error('Failed to fetch datasets:', response.error);
        }
      } catch (error) {
        console.error('Error loading datasets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleDatasetMenuClick = (dataset) => {
    console.log('Menu clicked for dataset:', dataset);
  };

  const handleDeleteDataset = async (datasetId) => {
    try {
      const response = await deleteDataset(datasetId);
      if (response.success) {
        // Refresh datasets
        const loadData = async () => {
          setLoading(true);
          try {
            const response = await fetchDatasets();
            if (response.success) {
              setDatasets(response.data);
            } else {
              console.error('Failed to fetch datasets:', response.error);
            }
          } catch (error) {
            console.error('Error loading datasets:', error);
          } finally {
            setLoading(false);
          }
        };
        loadData();
      } else {
        alert('Failed to delete dataset');
      }
    } catch (error) {
      console.error('Error deleting dataset:', error);
      alert('Failed to delete dataset');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Welcome back! Here's what's happening with your data.
          </p>
        </div>
        <Link
          to="/upload"
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Upload New Data</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <SkeletonLoader key={index} type="kpi" />
          ))
        ) : (
          buildStats(datasets).map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="card p-6 hover:shadow-md transform hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {stat.title}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Datasets Section */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Your Datasets
            </h2>
            <Link
              to="/upload"
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <SkeletonLoader key={`dataset-${index}`} type="card" />
              ))
            ) : datasets.length === 0 ? (
              <EmptyState 
                type="datasets"
                onAction={() => window.location.href = '/upload'}
                className="col-span-full"
              />
            ) : (
              datasets.map((dataset) => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  onMenuClick={handleDatasetMenuClick}
                  onDelete={handleDeleteDataset}
                />
              ))
            )}
          </div>
        </div>

        {/* Recent Insights */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Recent Insights
          </h2>
          <div className="space-y-3">
            <div className="card p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {datasets.length === 0
                  ? 'Upload a dataset to start getting AI-generated insights.'
                  : 'Insights are generated from your data on demand.'}
              </p>
              {datasets.length > 0 && (
                <Link
                  to="/insights"
                  className="inline-block mt-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 text-sm font-medium"
                >
                  Generate insights
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
