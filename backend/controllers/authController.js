const axios = require('axios');
const { getStore } = require('../services/store');
const { signToken } = require('../services/jwt');
const { hashPassword, verifyPassword, dummyHash } = require('../services/password');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatar_url: u.avatar_url || null,
  provider: u.provider,
  plan: u.plan,
  created_at: u.created_at,
});

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, password } = req.body || {};
    const email = normalizeEmail(req.body && req.body.email);

    if (typeof name !== 'string' || !name.trim() || typeof password !== 'string' || !email) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }
    if (name.trim().length > 100 || email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid name and email address' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ success: false, error: 'Password must be between 8 and 128 characters' });
    }

    const store = getStore();
    if (await store.users.findByEmail(email)) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const user = await store.users.create({
      name: name.trim(),
      email,
      password_hash: await hashPassword(password),
      provider: 'email',
      plan: 'free',
    });

    return res.status(201).json({ success: true, data: { user: publicUser(user), token: signToken(user.id, user.email) } });
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { password } = req.body || {};
    const email = normalizeEmail(req.body && req.body.email);
    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const store = getStore();
    const user = await store.users.findByEmail(email);
    // Always verify against a hash so response time does not reveal whether the email exists.
    const ok = await verifyPassword(password, user && user.password_hash ? user.password_hash : await dummyHash());
    if (!user || !user.password_hash || !ok) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    await store.users.touchLogin(user.id).catch((e) => console.warn('Could not update last_login:', e.message));
    return res.json({ success: true, data: { user: publicUser(user), token: signToken(user.id, user.email) } });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
};

// POST /api/auth/google  { credential: <Google ID token> }
// Verified server-side against Google. Disabled (501) until GOOGLE_CLIENT_ID is configured, because
// accepting a client-supplied name/email would let anyone sign in as any user.
const googleAuth = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(501).json({ success: false, error: 'Google sign-in is not configured on this server' });
  }
  try {
    const { credential } = req.body || {};
    if (typeof credential !== 'string' || !credential) {
      return res.status(400).json({ success: false, error: 'Google credential is required' });
    }
    const { data: info } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
      params: { id_token: credential },
      timeout: 8000,
    });
    if (info.aud !== clientId || String(info.email_verified) !== 'true' || !info.email) {
      return res.status(401).json({ success: false, error: 'Google credential rejected' });
    }

    const store = getStore();
    const email = normalizeEmail(info.email);
    let user = await store.users.findByEmail(email);
    if (user) {
      await store.users.touchLogin(user.id).catch(() => {});
    } else {
      user = await store.users.create({
        name: info.name || email.split('@')[0],
        email,
        avatar_url: info.picture || null,
        provider: 'google',
        plan: 'free',
      });
    }
    return res.json({ success: true, data: { user: publicUser(user), token: signToken(user.id, user.email) } });
  } catch (error) {
    console.error('Google auth error:', error.message);
    return res.status(401).json({ success: false, error: 'Google authentication failed' });
  }
};

// GET /api/auth/profile
const getProfile = async (req, res) => {
  try {
    const user = await getStore().users.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, data: publicUser(user) });
  } catch (error) {
    console.error('Get profile error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
};

module.exports = { register, login, googleAuth, getProfile };
