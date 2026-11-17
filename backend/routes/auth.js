const express = require('express');
const router = express.Router();
const { register, login, googleAuth, getProfile } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

// Per-IP limits on credential endpoints (in-memory, per process).
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30 });

// POST /api/auth/register - Register new user
router.post('/register', authLimiter, register);

// POST /api/auth/login - Login user
router.post('/login', authLimiter, login);

// POST /api/auth/google - Google sign-in (requires GOOGLE_CLIENT_ID)
router.post('/google', authLimiter, googleAuth);

// GET /api/auth/profile - Get user profile (protected)
router.get('/profile', authenticateToken, getProfile);

module.exports = router;
