import React, { useState, useEffect } from 'react';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Brain, Target, AlertTriangle, CheckCircle, BarChart3, RefreshCw, Lightbulb } from 'lucide-react';
import { fetchDatasets, generateInsights, generateRecommendations } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Insights = () => {
  const { user } = useAuth();
  const [selectedDataset, setSelectedDataset] = useState('');
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState([]);
  const [insights, setInsights] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('insights'); // 'insights', 'trends', 'recommendations'

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    if (selectedDataset) {
      generateDatasetInsights();
    }
  }, [selectedDataset]);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const response = await fetchDatasets();
      if (response.success) {
        setDatasets(response.data);
        if (response.data.length > 0) {
          setSelectedDataset(response.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading datasets:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDatasetInsights = async () => {
    if (!selectedDataset) return;
    
    try {
      setIsGenerating(true);
      
      // Generate insights
      const insightsResponse = await generateInsights(
        selectedDataset,
        user?.id || 'anonymous'
      );
      
      if (insightsResponse.success) {
        setInsights(insightsResponse.data);

        // Generate recommendations based on the FULL insights wrapper (insights + trends + anomalies)
        // The backend /recommendations endpoint expects: { "insights": {insights:[], trends:[], anomalies:[]}, ... }
        // So we pass insightsResponse.data (the full structured wrapper) as the "insights" field payload.
        const recommendationsResponse = await generateRecommendations(
          insightsResponse.data,
          'general business analysis'
        );

        if (recommendationsResponse.success) {
          setRecommendations(recommendationsResponse.data);
        }
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const refreshInsights = () => {
    generateDatasetInsights();
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'trend':
      case 'trends':
        return <TrendingUp className="w-5 h-5" />;
      case 'anomaly':
      case 'anomalies':
        return <AlertTriangle className="w-5 h-5" />;
      case 'distribution':
      case 'dataset_overview':
        return <BarChart3 className="w-5 h-5" />;
      case 'data_quality':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Brain className="w-5 h-5" />;
    }
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'trend':
      case 'trends':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'anomaly':
      case 'anomalies':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'distribution':
      case 'dataset_overview':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'data_quality':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
    }
  };

  const renderKPIs = () => {
    if (!insights) return null;

    const kpiData = [
      {
        title: 'Dataset Size',
        value: insights.insights.find(i => i.type === 'dataset_overview')?.description?.match(/(\d+) rows/)?.[1] || 'N/A',
        change: '+12%',
        positive: true
      },
      {
        title: 'Data Quality',
        value: insights.insights.find(i => i.type === 'data_quality') ? 'Good' : 'Excellent',
        change: '+5%',
        positive: true
      },
      {
        title: 'Anomalies Found',
        value: insights.anomalies?.length || 0,
        change: '-2',
        positive: false
      },
      {
        title: 'Trends Detected',
        value: insights.trends?.length || 0,
        change: '+3',
        positive: true
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpiData.map((kpi, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{kpi.title}</h3>
              {kpi.positive ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</div>
            <div className={`text-sm ${kpi.positive ? 'text-green-600' : 'text-red-600'}`}>
              {kpi.change} from last analysis
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderInsightsList = () => {
    if (!insights?.insights) return null;

    return (
      <div className="space-y-4">
        {insights.insights.map((insight, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {getInsightIcon(insight.type)}
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1 capitalize">
                  {insight.type.replace('_', ' ')}
                </h4>
                <p className="text-sm opacity-90">{insight.description}</p>
                {insight.confidence && (
                  <div className="mt-2 text-xs opacity-75">
                    Confidence: {Math.round(insight.confidence * 100)}%
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTrends = () => {
    if (!insights?.trends) return null;

    return (
      <div className="space-y-4">
        {insights.trends.map((trend, index) => (
          <div
            key={index}
            className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">
                  {trend.column} - {trend.direction === 'increasing' ? 'Rising' : 'Falling'} Trend
                </h4>
                <p className="text-sm opacity-90">{trend.description}</p>
                <div className="mt-2">
                  <div className="flex items-center space-x-4 text-xs">
                    <span>Strength: {Math.round(trend.strength * 100)}%</span>
                    <span>Confidence: {Math.round(trend.confidence * 100)}%</span>
                  </div>
                  <div className="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                    <div
                      className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full"
                      style={{ width: `${trend.strength * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAnomalies = () => {
    if (!insights?.anomalies) return null;

    return (
      <div className="space-y-4">
        {insights.anomalies.map((anomaly, index) => (
          <div
            key={index}
            className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">
                  {anomaly.type === 'outliers' ? 'Outliers Detected' : 'Anomaly Found'}
                </h4>
                <p className="text-sm opacity-90">{anomaly.description}</p>
                {anomaly.column && (
                  <div className="mt-2 text-xs opacity-75">
                    Column: {anomaly.column} • Count: {anomaly.count}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getRecommendationIcon = (iconKey) => {
    switch (iconKey) {
      case 'chart':
        return <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />;
      case 'trend':
        return <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />;
      case 'alert':
        return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />;
      case 'shield':
        return <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />;
      case 'target':
      default:
        return <Target className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5" />;
    }
  };

  const renderRecommendations = () => {
    if (!recommendations) return null;

    // Normalize legacy flat string list to structured format
    let recs = recommendations.recommendations || [];
    if (!Array.isArray(recs)) recs = [];

    const normalizedRecs = recs.map((rec, i) => {
      if (typeof rec === 'string') {
        return { category: 'General', icon: 'target', items: [rec] };
      }
      if (rec && typeof rec === 'object') {
        let items = rec.items || rec.recommendations || [];
        if (typeof items === 'string') items = [items];
        if (!Array.isArray(items)) items = [];
        if (items.length === 0 && typeof rec.description === 'string') {
          items = [rec.description];
        }
        return {
          category: rec.category || `Category ${i + 1}`,
          icon: rec.icon || 'target',
          items: items.filter(x => typeof x === 'string' && x.trim().length > 0)
        };
      }
      return { category: `Category ${i + 1}`, icon: 'target', items: [] };
    }).filter(rec => rec.items.length > 0);

    const actions = (recommendations.action_items || recommendations.actionItems || [])
      .filter(a => typeof a === 'string' && a.trim().length > 0);

    if (normalizedRecs.length === 0 && actions.length === 0) {
      return (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No recommendations available for this dataset yet.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {normalizedRecs.map((category, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center space-x-2 mb-4">
              {getRecommendationIcon(category.icon)}
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {category.category}
              </h3>
            </div>
            <div className="space-y-3">
              {category.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-start space-x-3">
                  <div className="mt-0.5 flex-shrink-0 w-5 h-5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center text-xs font-medium">
                    {itemIndex + 1}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Action Items */}
        {actions.length > 0 && (
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Lightbulb className="w-5 h-5 text-primary-700 dark:text-primary-300" />
              <h3 className="text-lg font-medium text-primary-900 dark:text-primary-100">
                Immediate Actions
              </h3>
            </div>
            <div className="space-y-2">
              {actions.map((action, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="w-2 h-2 mt-2 bg-primary-600 dark:bg-primary-400 rounded-full flex-shrink-0" />
                  <p className="text-sm text-primary-800 dark:text-primary-200 leading-relaxed">
                    {action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <SkeletonLoader height={40} className="mb-4" />
          <SkeletonLoader height={20} className="mb-2" width="60%" />
          <SkeletonLoader height={20} width="40%" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => (
            <SkeletonLoader key={i} height={120} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonLoader height={400} />
          <SkeletonLoader height={400} />
        </div>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <EmptyState
          icon={Brain}
          title="No datasets available"
          description="Upload a CSV dataset to start generating AI-powered insights."
          actionLabel="Upload Dataset"
          onAction={() => window.location.href = '/upload'}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            AI Insights & Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Automated insights and recommendations for your data
          </p>
        </div>
        <button
          onClick={refreshInsights}
          disabled={isGenerating}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Dataset Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Dataset
        </label>
        <select
          value={selectedDataset}
          onChange={(e) => setSelectedDataset(e.target.value)}
          disabled={isGenerating}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name} ({dataset.file_size ? `${dataset.file_size} bytes` : `${dataset.rows || 'Unknown'} rows`})
            </option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      {renderKPIs()}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'insights'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Brain className="w-4 h-4 inline mr-2" />
              Insights
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'trends'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Trends & Anomalies
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'recommendations'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Target className="w-4 h-4 inline mr-2" />
              Recommendations
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {isGenerating ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-gray-500 dark:text-gray-400">Generating insights...</span>
            </div>
          ) : (
            <>
              {activeTab === 'insights' && renderInsightsList()}
              {activeTab === 'trends' && (
                <div className="space-y-8">
                  {renderTrends()}
                  {renderAnomalies()}
                </div>
              )}
              {activeTab === 'recommendations' && renderRecommendations()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Insights;
