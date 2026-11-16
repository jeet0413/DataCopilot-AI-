const express = require('express');
const router = express.Router();
const { register, login, googleAuth, getProfile } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// POST /api/auth/register - Register new user
router.post('/register', register);

// POST /api/auth/login - Login user
router.post('/login', login);

// POST /api/auth/google - Google OAuth
router.post('/google', googleAuth);

// GET /api/auth/profile - Get user profile (protected)
router.get('/profile', authenticateToken, getProfile);

module.exports = router;
