const rateLimit = require('express-rate-limit');

/**
 * Brute-force protection for authentication endpoints. Keyed by client IP,
 * 10 attempts per 15 minutes per endpoint.
 *
 * Note: on serverless platforms (Vercel) the in-memory store is per-function
 * instance, so this is a first line of defence rather than a global limit.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
  },
});

module.exports = { authLimiter };
