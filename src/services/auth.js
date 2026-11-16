// Real authentication service for DataCopilot AI
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002/api';

// Store token in localStorage
const setToken = (token) => {
  localStorage.setItem('authToken', token);
};

const getToken = () => {
  return localStorage.getItem('authToken');
};

const removeToken = () => {
  localStorage.removeItem('authToken');
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;
  
  try {
    // Check if token is expired
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    
    // If token is expired, remove it and return false
    if (payload.exp <= currentTime) {
      removeToken();
      localStorage.removeItem('user');
      return false;
    }
    
    return true;
  } catch (error) {
    // If token is invalid, remove it and return false
    removeToken();
    localStorage.removeItem('user');
    return false;
  }
};

// Email/Password Login
export const login = async (email, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store token
    setToken(data.data.token);
    
    // Store user info
    localStorage.setItem('user', JSON.stringify(data.data.user));
    
    // Trigger storage event for other tabs
    window.dispatchEvent(new Event('storage'));

    return data.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Email/Password Registration
export const signup = async (userData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Store token
    setToken(data.data.token);
    
    // Store user info
    localStorage.setItem('user', JSON.stringify(data.data.user));
    
    // Trigger storage event for other tabs
    window.dispatchEvent(new Event('storage'));

    return data.data;
  } catch (error) {
    console.error('Signup error:', error);
    throw error;
  }
};

// Google OAuth
export const googleLogin = async (googleData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Google login failed');
    }

    // Store token
    setToken(data.data.token);
    
    // Store user info
    localStorage.setItem('user', JSON.stringify(data.data.user));
    
    // Trigger storage event for other tabs
    window.dispatchEvent(new Event('storage'));

    return data.data;
  } catch (error) {
    console.error('Google login error:', error);
    throw error;
  }
};

// Logout
export const logout = () => {
  removeToken();
  localStorage.removeItem('user');
  // Trigger storage event for other tabs
  window.dispatchEvent(new Event('storage'));
};

// Get user profile
export const getUserProfile = async () => {
  try {
    const token = getToken();
    if (!token) throw new Error('No token found');
    
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get user profile');
    }

    return data.data;
  } catch (error) {
    console.error('Get user profile error:', error);
    throw error;
  }
};

// Get current user from localStorage
export const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

// API helper with authentication
export const authenticatedFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
};
