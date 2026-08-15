// Local development / production-server entry point. Loads the Express app
// from app.js, connects to MongoDB, starts the in-process schedulers (unless
// running in serverless production) and begins listening.

require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { startReminderScheduler } = require('./services/reminderScheduler');
const { startRecurringScheduler } = require('./services/recurringScheduler');
const { startTaskScheduler } = require('./services/taskScheduler');

connectDB()
  .then(() => {
    // In production serverless (Vercel) the schedulers are driven by an external
    // cron service (POST /api/cron/tick). The in-process timer only runs in
    // development, or when RUN_SCHEDULERS=true is set explicitly.
    const runInProcess = process.env.RUN_SCHEDULERS === 'true' || process.env.NODE_ENV !== 'production';
    if (runInProcess) {
      startReminderScheduler();
      startRecurringScheduler();
      startTaskScheduler();
    } else {
      console.log(
        '[scheduler] in-process schedulers disabled (production) — cron endpoint enabled'
      );
    }
  })
  .catch((err) => {
    console.error(`[server] Failed to connect to MongoDB: ${err.message}`);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`LifeHub API running on port ${PORT} (TZ: ${process.env.TZ})`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
