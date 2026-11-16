// Authentication utility functions
export const isAuthenticated = () => {
  return localStorage.getItem('isAuthenticated') === 'true';
};

export const login = (email, password) => {
  // Mock authentication - in real app, this would call an API
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === 'demo@datacopilot.ai' && password === 'demo123') {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify({ email, name: 'Demo User' }));
        resolve({ success: true, user: { email, name: 'Demo User' } });
      } else {
        reject(new Error('Invalid credentials'));
      }
    }, 1000);
  });
};

export const signup = (userData) => {
  // Mock signup - in real app, this would call an API
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify(userData));
      resolve({ success: true, user: userData });
    }, 1500);
  });
};

export const logout = () => {
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};
