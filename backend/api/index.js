// Vercel serverless entry point — exposes the Express app directly.
// Schedulers must NOT run in-process here; external cron hits /api/cron/tick
// (see routes/cronRoutes.js and docs/production-checklist.md).
//
// Unlike server.js (which connects to MongoDB before listening), a serverless
// function must connect lazily and reuse the connection across warm
// invocations. We cache the connection promise at module scope so each cold
// start connects exactly once.

const app = require('../app');
const connectDB = require('../config/db');

let dbPromise = null;

async function handler(req, res) {
  try {
    dbPromise = dbPromise || connectDB();
    await dbPromise;
    return app(req, res);
  } catch (err) {
    // Connection failed — reset so the next invocation retries, then respond
    // safely (do not expose internals, do not call process.exit in a lambda).
    dbPromise = null;
    console.error(`[api] MongoDB connection error: ${err.message}`);
    if (!res.headersSent) {
      res.status(503).json({ success: false, message: 'Database unavailable' });
    }
  }
}

module.exports = handler;
