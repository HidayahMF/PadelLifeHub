// LifeHub AI routes.
//
// All endpoints require authentication (JWT). Rate limits are keyed per user
// (defaults: 10 requests/minute and 100 requests/day, configurable through
// AI_RATE_LIMIT_PER_MINUTE / AI_DAILY_LIMIT) so a single account cannot spam
// the Gemini API.

const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const aiController = require('../controllers/aiController');

const router = express.Router();

// Key by the authenticated user when present, fall back to the client IP
// (using the official helper so IPv6 handling stays correct).
const userKey = (req) => req.user?._id?.toString() ?? ipKeyGenerator(req);

const RATE_LIMIT_MESSAGE = {
  success: false,
  message: 'AI request limit reached. Please try again later.',
};

// Limits are read per request so operators can tune them via environment
// variables without a restart (and tests can exercise the limiter directly).
const aiPerMinuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: () => Number(process.env.AI_RATE_LIMIT_PER_MINUTE) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userKey,
  message: RATE_LIMIT_MESSAGE,
});

const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: () => Number(process.env.AI_DAILY_LIMIT) || 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userKey,
  message: RATE_LIMIT_MESSAGE,
});

// Auth runs before any AI endpoint — req.user._id is the source of truth for
// whose data may be read. The client can never override it.
router.use(protect);

router.post('/chat', aiPerMinuteLimiter, aiDailyLimiter, aiController.chat);
router.post('/financial-insight', aiPerMinuteLimiter, aiDailyLimiter, aiController.financialInsight);
router.post('/daily-plan', aiPerMinuteLimiter, aiDailyLimiter, aiController.dailyPlan);
router.post('/habit-insight', aiPerMinuteLimiter, aiDailyLimiter, aiController.habitInsight);
router.post('/goal-insight', aiPerMinuteLimiter, aiDailyLimiter, aiController.goalInsight);

module.exports = router;
