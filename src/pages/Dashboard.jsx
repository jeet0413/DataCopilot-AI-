import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Database, TrendingUp, Users, DollarSign } from 'lucide-react';
import DatasetCard from '../components/DatasetCard';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { fetchDatasets, deleteDataset } from '../services/api';

const stats = [
  {
    title: 'Total Datasets',
    value: '12',
    icon: Database,
    change: '+2',
    changeType: 'positive'
  },
  {
    title: 'Total Rows',
    value: '28.4K',
    icon: TrendingUp,
    change: '+23%',
    changeType: 'positive'
  },
  {
    title: 'Active Users',
    value: '1,234',
    icon: Users,
    change: '+12%',
    changeType: 'positive'
  },
  {
    title: 'Storage Used',
    value: '5.9 GB',
    icon: DollarSign,
    change: '+8%',
    changeType: 'positive'
  }
];

const recentInsights = [
  {
    id: 1,
    title: 'Sales Spike Detected',
    description: 'Electronics category shows 45% increase in weekly sales',
    time: '2 hours ago',
    type: 'success'
  },
  {
    id: 2,
    title: 'Customer Churn Alert',
    description: '15% increase in customer churn rate this month',
    time: '5 hours ago',
    type: 'warning'
  },
  {
    id: 3,
    title: 'Inventory Optimization',
    description: 'AI suggests reducing stock for low-performing products',
    time: '1 day ago',
    type: 'info'
  }
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
          stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="card p-6 hover:shadow-md transform hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'positive' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {stat.change}
                  </span>
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
            {recentInsights.map((insight) => (
              <div
                key={insight.id}
                className="card p-4 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    insight.type === 'success' ? 'bg-green-500' :
                    insight.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                      {insight.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {insight.description}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      {insight.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
