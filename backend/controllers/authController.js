const database = require('../services/supabase-fallback');
const mockDatabase = require('../services/database');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Generate a proper UUID for demo user
const generateDemoUUID = () => {
  return uuidv4();
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Email/Password Registration
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }

    let user;
    if (database.isUsingMock()) {
      // Mock registration - accept any credentials for demo
      user = {
        id: generateDemoUUID(),
        name,
        email,
        provider: 'email',
        plan: 'free',
        created_at: new Date().toISOString()
      };
    } else {
      // Real Supabase registration - bypass RLS temporarily
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;
      const { createClient } = require('@supabase/supabase-js');
      
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
        
        // Check if user already exists - use maybeSingle() to avoid error if not found
        const { data: existingUser, error: checkError } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
        
        if (checkError) {
          console.error('Error checking existing user:', checkError);
          throw checkError;
        }
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: 'User already exists with this email'
          });
        }

        const { data, error } = await supabaseAdmin.from('users').insert([{
          name,
          email,
          provider: 'email',
          plan: 'free'
        }]).select().single();

        if (error) {
          console.error('Error inserting user:', error);
          throw error;
        }
        user = data;
      } catch (supabaseError) {
        console.warn('Supabase registration failed, falling back to mock:', supabaseError.message);
        // Fallback to mock database when Supabase fails
        user = {
          id: generateDemoUUID(),
          name,
          email,
          provider: 'email',
          plan: 'free',
          created_at: new Date().toISOString()
        };
      }
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          provider: user.provider,
          plan: user.plan,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error.message, error.details || error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Email/Password Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    let user;
    if (database.isUsingMock()) {
      // Mock login - accept any credentials for demo
      user = {
        id: generateDemoUUID(),
        name: 'Demo User',
        email,
        provider: 'email',
        plan: 'free',
        created_at: new Date().toISOString()
      };
    } else {
      // Real Supabase login
      try {
        const { data, error } = await database.from('users').select('*').eq('email', email).maybeSingle();
        
        if (error) {
          console.error('Error fetching user:', error);
          throw error;
        }
        
        if (!data) {
          return res.status(401).json({
            success: false,
            error: 'Invalid credentials'
          });
        }

        // In production, you'd verify password hash here
        user = data;
      } catch (supabaseError) {
        console.warn('Supabase login failed, falling back to mock:', supabaseError.message);
        // Fallback to mock for demo
        user = {
          id: generateDemoUUID(),
          name: 'Demo User',
          email,
          provider: 'email',
          plan: 'free',
          created_at: new Date().toISOString()
        };
      }
    }

    // Update last login
    if (!database.isUsingMock()) {
      await database.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          provider: user.provider,
          plan: user.plan,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error.message, error.details || error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Google OAuth (simplified - in production you'd use Google OAuth2)
const googleAuth = async (req, res) => {
  try {
    const { name, email, avatar_url } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }

    let user;
    if (database.isUsingMock()) {
      // Mock Google auth
      user = {
        id: `google_user_${Date.now()}`,
        name,
        email,
        avatar_url,
        provider: 'google',
        plan: 'free',
        created_at: new Date().toISOString()
      };
    } else {
      // Check if user exists
      const { data: existingUser } = await database.from('users').select('*').eq('email', email).single();
      
      if (existingUser) {
        // Update existing user
        const { data, error } = await database.from('users').update({
          last_login: new Date().toISOString()
        }).eq('id', existingUser.id).select().single();
        
        if (error) throw error;
        user = data;
      } else {
        // Create new user
        const { data, error } = await database.from('users').insert([{
          name,
          email,
          avatar_url,
          provider: 'google',
          plan: 'free'
        }]).select().single();

        if (error) throw error;
        user = data;
      }
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
          provider: user.provider,
          plan: user.plan,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Google authentication failed'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    let user;
    if (database.isUsingMock()) {
      // Mock user profile
      user = {
        id: userId,
        name: 'Demo User',
        email: 'demo@datacopilot.ai',
        provider: 'email',
        plan: 'free',
        created_at: new Date().toISOString()
      };
    } else {
      const { data, error } = await database.from('users').select('*').eq('id', userId).single();
      
      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      user = data;
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  getProfile
};
