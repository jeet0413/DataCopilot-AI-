import React, { useState, useEffect } from 'react';
import ChatBox from '../components/ChatBox';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Database, Lightbulb, TrendingUp, Table, BarChart3, MessageSquare, AlertTriangle, CheckCircle } from 'lucide-react';
import { fetchDatasets, processNaturalLanguageQuery } from '../services/api';

const Query = () => {
  const [selectedDataset, setSelectedDataset] = useState('');
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState([]);
  const [recentQueries, setRecentQueries] = useState([]);
  const [, setCurrentQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'results', 'insights', 'chart'
  
  // Load recent queries from localStorage on mount
  useEffect(() => {
    const savedQueries = localStorage.getItem('recentQueries');
    if (savedQueries) {
      try {
        setRecentQueries(JSON.parse(savedQueries));
      } catch (error) {
        console.error('Error loading recent queries:', error);
        setRecentQueries([]);
      }
    }
    loadDatasets();
  }, []);

  // Save recent queries to localStorage whenever they change
  useEffect(() => {
    if (recentQueries.length > 0) {
      localStorage.setItem('recentQueries', JSON.stringify(recentQueries));
    }
  }, [recentQueries]);

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

  const handleQuerySubmit = async (query) => {
    if (!query.trim() || !selectedDataset) return;
    
    try {
      setIsProcessing(true);
      setCurrentQuery(query);
      
      const response = await processNaturalLanguageQuery(query, selectedDataset);
      
      if (response.success) {
        setQueryResult(response.data);
        setActiveTab('results');
        
        // Add to recent queries
        const newQuery = {
          id: Date.now(),
          query,
          response: response.data.sql_query,
          timestamp: 'Just now',
          dataset: datasets.find(d => d.id === selectedDataset)?.name || 'Unknown',
          results: response.data.data || response.data.results || []
        };
        setRecentQueries(prev => [newQuery, ...prev.slice(0, 4)]); // Keep last 5
        return response.data;
      }
      return { error: response.error || 'Query failed' };
    } catch (error) {
      console.error('Error processing query:', error);
      // Show error in chat
      setQueryResult({
        error: error.message,
        sql_query: 'Error occurred',
        results: []
      });
      return { error: error.message };
    } finally {
      setIsProcessing(false);
    }
  };

  const sampleQueries = [
    'Show me the total number of records',
    'What are the average values?',
    'Find the maximum values',
    'Show me recent records',
    'Count records by category'
  ];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      console.log('Query copied to clipboard:', text);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const renderChart = () => {
    if (!queryResult || !queryResult.chart || queryResult.chart.chart_type === 'table') return null;

    const { chart_type, x_axis, y_axis, title } = queryResult.chart;
    const chartData = queryResult.data || queryResult.results || [];

    switch (chart_type) {
      case 'bar':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={x_axis} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey={y_axis} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'line':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={x_axis} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey={y_axis} stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'pie':
        const pieData = chartData.reduce((acc, item) => {
          const category = item[x_axis];
          const existing = acc.find(x => x.name === category);
          if (existing) {
            existing.value += 1;
          } else {
            acc.push({ name: category, value: 1 });
          }
          return acc;
        }, []);

        const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'];

        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case 'scatter':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={x_axis} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Scatter dataKey={y_axis} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        );

      default:
        return null;
    }
  };

  const renderInsights = () => {
    if (!queryResult || !queryResult.insights) return null;

    const insights = queryResult.insights;
    const hasInsights = Array.isArray(insights.insights) && insights.insights.length > 0;
    const hasTrends = Array.isArray(insights.trends) && insights.trends.length > 0;
    const hasAnomalies = Array.isArray(insights.anomalies) && insights.anomalies.length > 0;

    if (!hasInsights && !hasTrends && !hasAnomalies) {
      // Legacy: insights was a plain string (shouldn't happen now but guard)
      if (typeof insights === 'string') {
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">AI Insights</h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{insights}</p>
            </div>
          </div>
        );
      }
      return null;
    }

    const iconForType = (type) => {
      if (type === 'trend' || type === 'trends' || type === 'numeric_trend' || type === 'statistical_trend' || type === 'business_trend' || type === 'category_trend' || type === 'customer_trend' || type === 'demographic_trend' || type === 'contact_trend') {
        return <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />;
      }
      if (type === 'anomaly' || type === 'anomalies' || type === 'outliers') {
        return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
      }
      if (type === 'data_quality') {
        return <CheckCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />;
      }
      return <Lightbulb className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />;
    };

    const bgForType = (type) => {
      if (type === 'trend' || type === 'trends' || /trend$/i.test(type || '')) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      if (type === 'anomaly' || type === 'anomalies' || /anomal/i.test(type || '')) return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      if (type === 'data_quality') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    };

    const renderInsightCards = (items) => items.map((item, i) => {
      const desc = typeof item === 'string' ? item : item?.description || JSON.stringify(item);
      const type = typeof item === 'string' ? 'dataset_overview' : item?.type || 'dataset_overview';
      return (
        <div
          key={i}
          className={`p-3 rounded-lg border ${bgForType(type)} mb-2`}
        >
          <div className="flex items-start space-x-2">
            {iconForType(type)}
            <div className="flex-1">
              {typeof item !== 'string' && item?.type && (
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  {item.type.replace(/_/g, ' ')}
                </div>
              )}
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{desc}</p>
            </div>
          </div>
        </div>
      );
    });

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          <Lightbulb className="w-4 h-4 inline mr-2 text-yellow-500" />
          AI Insights Summary
        </h3>
        {hasInsights && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Key Insights ({insights.insights.length})
            </h4>
            {renderInsightCards(insights.insights)}
          </div>
        )}
        {hasTrends && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Trends Detected ({insights.trends.length})
            </h4>
            {renderInsightCards(insights.trends)}
          </div>
        )}
        {hasAnomalies && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Anomalies & Alerts ({insights.anomalies.length})
            </h4>
            {renderInsightCards(insights.anomalies)}
          </div>
        )}
      </div>
    );
  };

  const renderRecommendations = () => {
    if (!queryResult || !queryResult.recommendations || queryResult.recommendations.length === 0) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Business Recommendations</h3>
        <ul className="space-y-3">
          {queryResult.recommendations.map((recommendation, index) => (
            <li key={index} className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </span>
              <span className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {recommendation}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderQueryResults = () => {
    if (!queryResult) return null;

    if (queryResult.error) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-red-800 dark:text-red-200 font-medium mb-2">Query Error</h3>
          <p className="text-red-600 dark:text-red-400">{queryResult.error}</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* SQL Query Display */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Generated SQL</h3>
          <code className="block text-sm text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 p-3 rounded">
            {queryResult.sql_query}
          </code>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Executed in {queryResult.execution_time?.toFixed(2)}s • {queryResult.row_count} rows returned
          </div>
        </div>

        {/* Results Table */}
        {(queryResult.data || queryResult.results) && (queryResult.data || queryResult.results).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Query Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {Object.keys((queryResult.data || queryResult.results)[0]).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {(queryResult.data || queryResult.results).map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      {Object.values(row).map((value, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap"
                        >
                          {value !== null ? String(value) : 'NULL'}
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
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <SkeletonLoader height={40} className="mb-4" />
          <SkeletonLoader height={20} className="mb-2" width="60%" />
          <SkeletonLoader height={20} width="40%" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SkeletonLoader height={400} />
          </div>
          <div>
            <SkeletonLoader height={300} />
          </div>
        </div>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <EmptyState
          icon={Database}
          title="No datasets available"
          description="Upload a CSV dataset to start analyzing your data with AI."
          actionLabel="Upload Dataset"
          onAction={() => window.location.href = '/upload'}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            AI Data Analyst
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Ask questions about your data in natural language and get instant insights
          </p>
        </div>

        {/* Dataset Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Dataset
          </label>
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name} ({dataset.file_size ? `${dataset.file_size} bytes` : `${dataset.rows || 'Unknown'} rows`})
              </option>
            ))}
          </select>
        </div>

        {/* Sample Queries */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Sample Queries
          </h3>
          <div className="flex flex-wrap gap-2">
            {sampleQueries.map((query, index) => (
              <div key={index} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-1">
                <button
                  onClick={() => handleQuerySubmit(query)}
                  className="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  title="Click to execute this query"
                >
                  {query}
                </button>
                <button
                  onClick={() => copyToClipboard(query)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            💡 Click on query text to execute, or click copy icon to paste in chat box
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Interface - Takes 3 columns */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-3 text-sm font-medium ${
                      activeTab === 'chat'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 inline mr-2" />
                    Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('results')}
                    className={`px-4 py-3 text-sm font-medium ${
                      activeTab === 'results'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Table className="w-4 h-4 inline mr-2" />
                    Results
                  </button>
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={`px-4 py-3 text-sm font-medium ${
                      activeTab === 'chart'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 inline mr-2" />
                    Chart
                  </button>
                  <button
                    onClick={() => setActiveTab('insights')}
                    className={`px-4 py-3 text-sm font-medium ${
                      activeTab === 'insights'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Lightbulb className="w-4 h-4 inline mr-2" />
                    Insights
                  </button>
                  <button
                    onClick={() => setActiveTab('recommendations')}
                    className={`px-4 py-3 text-sm font-medium ${
                      activeTab === 'recommendations'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4 inline mr-2" />
                    Recommendations
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'chat' ? (
                  <ChatBox
                    onQuerySubmit={handleQuerySubmit}
                    isProcessing={isProcessing}
                    placeholder="Ask about your data in natural language..."
                  />
                ) : activeTab === 'results' ? (
                  renderQueryResults()
                ) : activeTab === 'chart' ? (
                  renderChart()
                ) : activeTab === 'insights' ? (
                  renderInsights()
                ) : activeTab === 'recommendations' ? (
                  renderRecommendations()
                ) : null}
              </div>
            </div>
          </div>

          {/* Sidebar - Takes 1 column */}
          <div className="space-y-6">
            {/* Recent Queries */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Recent Queries
              </h3>
              {recentQueries.length > 0 ? (
                <div className="space-y-3">
                  {recentQueries.map((query) => (
                    <div
                      key={query.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => {
                            setCurrentQuery(query.query);
                            setQueryResult({
                              sql_query: query.response,
                              results: query.results || []
                            });
                            setActiveTab('results');
                          }}
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                            {query.query}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {query.timestamp} • {query.dataset}
                          </p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(query.query)}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                          title="Copy query to clipboard"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No recent queries yet. Start by asking a question about your data.
                </p>
              )}
            </div>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
              <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">
                <Lightbulb className="w-5 h-5 inline mr-2" />
                Pro Tips
              </h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li>• Ask specific questions about your data</li>
                <li>• Use natural language - no SQL required</li>
                <li>• Try aggregations like "average", "sum", "count"</li>
                <li>• Ask for trends or patterns in your data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Query;
