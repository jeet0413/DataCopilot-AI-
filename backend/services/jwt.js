// JWT helpers. The signing secret must come from the environment; there is no built-in default.
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const KNOWN_WEAK_SECRETS = new Set([
  'your-secret-key-change-in-production',
  'datacopilot-ai-super-secret-jwt-key-2024-change-in-production',
  'changeme',
  'secret',
]);

let cachedSecret;

function resolveSecret() {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const weak = !fromEnv || fromEnv.length < 32 || KNOWN_WEAK_SECRETS.has(fromEnv);
  if (weak) {
    if (isProd) {
      throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in production.');
    }
    // Development only: random per-process secret. Tokens stop working when the server restarts.
    console.warn('⚠️  JWT_SECRET is missing or weak; using a temporary random secret (dev only).');
    cachedSecret = crypto.randomBytes(48).toString('hex');
  } else {
    cachedSecret = fromEnv;
  }
  return cachedSecret;
}

function signToken(userId, email) {
  return jwt.sign({ userId, email }, resolveSecret(), { algorithm: 'HS256', expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, resolveSecret(), { algorithms: ['HS256'] });
}

function resetForTests() {
  cachedSecret = undefined;
}

module.exports = { signToken, verifyToken, resolveSecret, resetForTests };
