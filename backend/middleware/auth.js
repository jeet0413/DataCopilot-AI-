const { verifyToken } = require('../services/jwt');

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  return scheme && scheme.toLowerCase() === 'bearer' && token ? token : null;
}

// Authentication middleware: 401 when no token, 403 when the token is invalid or expired.
const authenticateToken = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};

// Optional authentication: sets req.user when a valid token is present, never fails.
const optionalAuth = (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // ignore invalid token
    }
  }
  next();
};

module.exports = { authenticateToken, optionalAuth };
