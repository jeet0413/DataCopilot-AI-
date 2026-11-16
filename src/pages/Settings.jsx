import React, { useState } from 'react';
import { User, Bell, Shield, Database, Palette, HelpCircle, ExternalLink, Mail, MessageCircle, Book, FileText, Github, Twitter } from 'lucide-react';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    company: 'DataCorp',
    bio: 'Data analyst passionate about insights and analytics.'
  });

  const tabs = [
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'security', icon: Shield, label: 'Security' },
    { id: 'privacy', icon: Database, label: 'Data & Privacy' },
    { id: 'appearance', icon: Palette, label: 'Appearance' },
    { id: 'help', icon: HelpCircle, label: 'Help & Support' }
  ];

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = () => {
    // Save profile logic here
    console.log('Saving profile:', profileData);
    alert('Profile saved successfully!');
  };

  const handleSaveNotifications = () => {
    // Save notifications logic here
    console.log('Saving notification settings');
    alert('Notification settings saved successfully!');
  };

  const handleSaveSecurity = () => {
    // Save security logic here
    console.log('Saving security settings');
    alert('Security settings saved successfully!');
  };

  const handleSaveAppearance = () => {
    // Save appearance logic here
    console.log('Saving appearance settings');
    alert('Appearance settings saved successfully!');
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Profile Information
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => handleProfileChange('firstName', e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => handleProfileChange('lastName', e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={profileData.email}
                  onChange={(e) => handleProfileChange('email', e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Company
                </label>
                <input
                  type="text"
                  id="company"
                  value={profileData.company}
                  onChange={(e) => handleProfileChange('company', e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => handleProfileChange('bio', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSaveProfile} className="btn-primary">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        );
      
      case 'notifications':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Notification Settings
            </h2>
            
            {/* Email Notifications */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Email Notifications</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="email-datasets"
                      defaultChecked={true}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div>
                      <label htmlFor="email-datasets" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                        Dataset Updates
                      </label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Get notified when your datasets are processed or updated</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="email-security"
                      defaultChecked={true}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div>
                      <label htmlFor="email-security" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                        Security Alerts
                      </label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Important security notifications and login attempts</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="email-newsletter"
                      defaultChecked={false}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div>
                      <label htmlFor="email-newsletter" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                        Newsletter
                      </label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Product updates, tips, and new features</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Push Notifications */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Push Notifications</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="push-datasets"
                      defaultChecked={true}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div>
                      <label htmlFor="push-datasets" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                        Dataset Processing
                      </label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Real-time updates when your datasets are being processed</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="push-system"
                      defaultChecked={false}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div>
                      <label htmlFor="push-system" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                        System Messages
                      </label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">System maintenance and important announcements</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Notification Frequency */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notification Frequency</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Digest Frequency
                </label>
                <select className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white">
                  <option value="realtime">Real-time</option>
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Digest</option>
                  <option value="never">Never</option>
                </select>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Choose how often you want to receive email notifications
                </p>
              </div>
            </div>
            
            {/* Save Button */}
            <div className="flex justify-end">
              <button onClick={handleSaveNotifications} className="btn-primary">
                Save Notification Settings
              </button>
            </div>
          </div>
        );
      
      case 'security':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Security Settings
            </h2>
            
            {/* Password Change */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Change Password</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                    placeholder="Enter new password"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Password must be at least 8 characters long
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                    placeholder="Confirm new password"
                  />
                </div>
                <button onClick={handleSaveSecurity} className="btn-primary">
                  Update Password
                </button>
              </div>
            </div>
            
            {/* Two-Factor Authentication */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Enable 2FA</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Add an extra layer of security to your account</p>
                  </div>
                  <button className="btn-secondary">
                    Enable 2FA
                  </button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>Two-factor authentication adds an additional layer of security by requiring a code from your mobile device when signing in.</p>
                </div>
              </div>
            </div>
            
            {/* Active Sessions */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Active Sessions</h3>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Current Session</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Chrome on Windows • Active now</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded-full">
                      Current
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Mobile Session</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Safari on iPhone • 2 hours ago</p>
                    </div>
                    <button className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium">
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Login Alerts */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Login Alerts</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Email Notifications</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Get notified when someone logs into your account</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'privacy':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Data & Privacy
            </h2>
            
            {/* Data Export */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Data Export</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Database className="w-6 h-6 text-primary-600 dark:text-primary-400 mt-1" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Export Your Data</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Download all your data including datasets, profile information, and settings in JSON format
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <input type="checkbox" id="export-datasets" defaultChecked={true} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                        <label htmlFor="export-datasets">Datasets and metadata</label>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <input type="checkbox" id="export-profile" defaultChecked={true} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                        <label htmlFor="export-profile">Profile information</label>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <input type="checkbox" id="export-settings" defaultChecked={false} className="w-4 h-4 text-primary-600 border-gray-300 rounded" />
                        <label htmlFor="export-settings">Application settings</label>
                      </div>
                    </div>
                    <button 
                      onClick={() => alert('Data export feature coming soon!')}
                      className="btn-secondary mt-4"
                    >
                      Export My Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Data Retention */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Data Retention</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Inactive Account Cleanup</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Automatically delete data after 2 years of inactivity</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1"></span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Deleted Dataset Recovery</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Keep deleted datasets in trash for 30 days</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Privacy Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Privacy Settings</h3>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Analytics Data</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Help us improve DataCopilot AI with anonymous usage data</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Public Profile</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Make your profile visible to other users</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1"></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Delete Account */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Account</h3>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">Permanently Delete Account</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      This action cannot be undone. All your data including datasets, profile information, and settings will be permanently deleted.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm text-red-700 dark:text-red-300">
                        <input type="checkbox" id="confirm-delete" className="w-4 h-4 text-red-600 border-red-300 rounded" />
                        <label htmlFor="confirm-delete">I understand that this action cannot be undone</label>
                      </div>
                      <button 
                        onClick={() => alert('Account deletion requires additional confirmation')}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={true}
                      >
                        Delete My Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'appearance':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Appearance Settings
            </h2>
            
            {/* Theme Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Theme</h3>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Dark Mode</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Toggle dark/light theme</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Auto Theme</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Follow system theme preference</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1"></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Language Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Language & Region</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Language
                  </label>
                  <select className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white">
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="ja">日本語</option>
                    <option value="zh">中文</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time Zone
                  </label>
                  <select className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white">
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date Format
                  </label>
                  <select className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white">
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD MMM YYYY">DD MMM YYYY</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Display Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Display</h3>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Compact View</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Show more content with less spacing</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1"></span>
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Show Animations</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Enable interface animations and transitions</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">High Contrast</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Increase contrast for better visibility</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1"></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Font Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Font Size</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-4">
                  <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
                    Small
                  </button>
                  <button className="px-3 py-1 text-sm bg-primary-600 text-white border border-primary-600 rounded-lg">
                    Medium
                  </button>
                  <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
                    Large
                  </button>
                  <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
                    Extra Large
                  </button>
                </div>
              </div>
            </div>
            
            {/* Save Button */}
            <div className="flex justify-end">
              <button onClick={handleSaveAppearance} className="btn-primary">
                Save Appearance Settings
              </button>
            </div>
          </div>
        );
      
      case 'help':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Help & Support
            </h2>
            
            {/* Documentation Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Documentation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                  <div className="flex items-start space-x-3">
                    <Book className="w-6 h-6 text-primary-600 dark:text-primary-400 mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Getting Started Guide</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Learn the basics of DataCopilot AI</p>
                      <button 
                        onClick={() => window.open('#', '_blank')}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium flex items-center space-x-1"
                      >
                        <span>Read Guide</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                  <div className="flex items-start space-x-3">
                    <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400 mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">API Documentation</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Complete API reference and examples</p>
                      <button 
                        onClick={() => window.open('#', '_blank')}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium flex items-center space-x-1"
                      >
                        <span>View API Docs</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                  <div className="flex items-start space-x-3">
                    <Github className="w-6 h-6 text-primary-600 dark:text-primary-400 mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">GitHub Repository</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Source code and contributions</p>
                      <button 
                        onClick={() => window.open('#', '_blank')}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium flex items-center space-x-1"
                      >
                        <span>Visit GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                  <div className="flex items-start space-x-3">
                    <MessageCircle className="w-6 h-6 text-primary-600 dark:text-primary-400 mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Community Forum</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Get help from the community</p>
                      <button 
                        onClick={() => window.open('#', '_blank')}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium flex items-center space-x-1"
                      >
                        <span>Join Forum</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Contact Support Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Contact Support</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Mail className="w-6 h-6 text-primary-600 dark:text-primary-400 mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Email Support</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Get help via email within 24 hours</p>
                      <button 
                        onClick={() => window.location.href = 'mailto:support@datacopilot.ai'}
                        className="btn-primary w-full"
                      >
                        Send Email
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <MessageCircle className="w-6 h-6 text-primary-600 dark:text-primary-400 mt-1" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Live Chat</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Chat with our support team</p>
                      <button 
                        onClick={() => alert('Live chat feature coming soon!')}
                        className="btn-secondary w-full"
                      >
                        Start Chat
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Social Media */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Follow Us</h3>
              <div className="flex space-x-4">
                <button 
                  onClick={() => window.open('#', '_blank')}
                  className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                  title="Twitter"
                >
                  <Twitter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button 
                  onClick={() => window.open('#', '_blank')}
                  className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                  title="GitHub"
                >
                  <Github className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
            
            {/* FAQ Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Frequently Asked Questions</h3>
              <div className="space-y-3">
                <details className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <summary className="font-medium text-gray-900 dark:text-white cursor-pointer">How do I upload a dataset?</summary>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Navigate to the Upload page from the sidebar, drag and drop your CSV file or click to select, and click upload. Your dataset will be processed and available in your dashboard.
                  </p>
                </details>
                <details className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <summary className="font-medium text-gray-900 dark:text-white cursor-pointer">What file formats are supported?</summary>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Currently, we support CSV (Comma Separated Values) files. We're working on adding support for Excel, JSON, and other formats in future updates.
                  </p>
                </details>
                <details className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <summary className="font-medium text-gray-900 dark:text-white cursor-pointer">How secure is my data?</summary>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Your data is encrypted and stored securely in Supabase. We use industry-standard security practices and you maintain full control over your data.
                  </p>
                </details>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your account and application preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
