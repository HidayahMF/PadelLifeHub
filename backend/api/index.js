// Vercel serverless entry point — exposes the Express app directly.
// Schedulers must NOT run in-process here; external cron hits /api/cron/tick
// (see routes/cronRoutes.js and docs/production-checklist.md).

module.exports = require('../app');
