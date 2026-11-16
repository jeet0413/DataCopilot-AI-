// Minimal in-memory rate limiter (per process). Good enough to blunt password guessing on a single
// instance; use a shared store (Redis) behind a load balancer.
function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, keyFn } = {}) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  if (timer.unref) timer.unref();

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ success: false, error: 'Too many attempts. Please try again later.' });
    }
    next();
  };
}

module.exports = { rateLimit };
