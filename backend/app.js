// Express application (no listen). Used by server.js for local development
// and by api/index.js for the Vercel serverless deployment.

// Force the application timezone to Asia/Jakarta (UTC+7) BEFORE anything else
// so every `new Date()` local-time operation uses WIB consistently.
process.env.TZ = process.env.TZ || 'Asia/Jakarta';

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Fail loudly when a placeholder JWT secret is used.
if (
  process.env.JWT_SECRET &&
  (process.env.JWT_SECRET === 'change-me-to-a-long-random-string' ||
    process.env.JWT_SECRET.length < 32)
) {
  console.warn(
    '[security] WARNING: JWT_SECRET is weak or a placeholder. Generate a strong one: ' +
      "node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
  );
}

if (process.env.NODE_ENV === 'production' && !process.env.CRON_SECRET) {
  console.warn(
    '[security] WARNING: CRON_SECRET is not set in production. The cron endpoint is disabled.'
  );
}

app.use(
  helmet({
    // GIS (Google Identity Services) injects the sign-in button from
    // accounts.google.com; a strict default CSP would block it. We keep all
    // other helmet headers and disable only the CSP layer.
    contentSecurityPolicy: false,
  })
);
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:4200').trim();
let clientOriginValid = true;
try {
  const parsed = new URL(clientUrl);
  if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname) {
    throw new Error('not an http(s) origin');
  }
} catch {
  clientOriginValid = false;
}
if (!clientOriginValid) {
  console.error(
    `[security] WARNING: CLIENT_URL is not a valid http(s) origin: "${clientUrl}". ` +
      'Browser requests from the frontend will be blocked by CORS. ' +
      'Set CLIENT_URL to your frontend URL, e.g. https://lifehub-psi-two.vercel.app'
  );
}
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (avatars) from the uploads directory (dev/local mode).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({
    name: 'LifeHub API',
    version: '1.0.0',
    status: 'running',
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/budgets', require('./routes/budgetRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/needs', require('./routes/needRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/goals', require('./routes/goalRoutes'));
app.use('/api/habits', require('./routes/habitRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/focus-sessions', require('./routes/focusSessionRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/today', require('./routes/todayRoutes'));
app.use('/api/insights', require('./routes/insightsRoutes'));
app.use('/api/weekly-review', require('./routes/weeklyReviewRoutes'));
app.use('/api/monthly-review', require('./routes/monthlyReviewRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/cron', require('./routes/cronRoutes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
