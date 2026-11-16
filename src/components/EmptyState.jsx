import React from 'react';
import { 
  Database, 
  Upload, 
  Search, 
  BarChart3, 
  MessageSquare, 
  FileText,
  Inbox,
  TrendingUp,
  Users
} from 'lucide-react';

const EmptyState = ({ 
  type = 'default', 
  title, 
  description, 
  actionText, 
  onAction,
  className = ''
}) => {
  const getIcon = () => {
    switch (type) {
      case 'datasets':
        return <Database className="w-16 h-16 text-gray-400" />;
      case 'upload':
        return <Upload className="w-16 h-16 text-gray-400" />;
      case 'search':
        return <Search className="w-16 h-16 text-gray-400" />;
      case 'insights':
        return <BarChart3 className="w-16 h-16 text-gray-400" />;
      case 'chat':
        return <MessageSquare className="w-16 h-16 text-gray-400" />;
      case 'files':
        return <FileText className="w-16 h-16 text-gray-400" />;
      case 'inbox':
        return <Inbox className="w-16 h-16 text-gray-400" />;
      case 'analytics':
        return <TrendingUp className="w-16 h-16 text-gray-400" />;
      case 'users':
        return <Users className="w-16 h-16 text-gray-400" />;
      default:
        return <Inbox className="w-16 h-16 text-gray-400" />;
    }
  };

  const getDefaultContent = () => {
    switch (type) {
      case 'datasets':
        return {
          title: 'No datasets yet',
          description: 'Upload your first CSV file to start analyzing your data with AI.',
          actionText: 'Upload Data'
        };
      case 'upload':
        return {
          title: 'No data uploaded yet',
          description: 'Drag and drop CSV files here or click to browse from your computer.',
          actionText: 'Select Files'
        };
      case 'search':
        return {
          title: 'No results found',
          description: 'Try adjusting your search terms or filters to find what you\'re looking for.',
          actionText: 'Clear Search'
        };
      case 'insights':
        return {
          title: 'No insights available',
          description: 'Upload some data and let our AI generate insights for you.',
          actionText: 'Generate Insights'
        };
      case 'chat':
        return {
          title: 'Start a conversation',
          description: 'Ask questions about your data and get AI-powered insights.',
          actionText: 'Ask a Question'
        };
      case 'files':
        return {
          title: 'No files found',
          description: 'There are no files in this category yet.',
          actionText: 'Add Files'
        };
      case 'analytics':
        return {
          title: 'No analytics data',
          description: 'Start collecting data to see detailed analytics and trends.',
          actionText: 'View Dashboard'
        };
      default:
        return {
          title: 'Nothing here yet',
          description: 'Get started by adding some content to this section.',
          actionText: 'Get Started'
        };
    }
  };

  const content = title || description || actionText 
    ? { title, description, actionText }
    : getDefaultContent();

  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      <div className="mb-6 animate-fade-in">
        {getIcon()}
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 animate-slide-up">
        {content.title}
      </h3>
      
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {content.description}
      </p>
      
      {onAction && content.actionText && (
        <button
          onClick={onAction}
          className="btn-primary animate-slide-up transform hover:scale-105 transition-all duration-200"
          style={{ animationDelay: '0.2s' }}
        >
          {content.actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
