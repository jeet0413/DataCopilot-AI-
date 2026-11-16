import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Upload, 
  MessageSquare, 
  BarChart3, 
  Settings,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { logout } from '../services/auth';

const Sidebar = ({ darkMode, setDarkMode }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/upload', icon: Upload, label: 'Upload' },
    { path: '/query', icon: MessageSquare, label: 'Query' },
    { path: '/insights', icon: BarChart3, label: 'Insights' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen">
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-8">
          <img src="/logo.svg" alt="DataCopilot AI" className="w-8 h-8" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            DataCopilot AI
          </h1>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            {darkMode ? (
              <>
                <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-gray-700" />
                <span className="text-gray-700 font-medium">Dark Mode</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => {
              logout();
              // Force page reload to trigger auth state check and redirect to landing page
              window.location.href = '/';
            }}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors duration-200"
          >
            <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-600 dark:text-red-400 font-medium">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
