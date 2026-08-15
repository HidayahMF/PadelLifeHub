// Scheduler runner — shared by the in-process timer (development) and the
// external cron trigger (production, e.g. cron-job.org → POST /api/cron/tick).

const { tick: reminderTick } = require('./reminderScheduler');
const { tick: recurringTick } = require('./recurringScheduler');
const { tick: taskTick } = require('./taskScheduler');

/**
 * Run every scheduler job once. Resolves when all jobs finished; individual
 * jobs swallow their own errors so one failure never blocks the others.
 */
async function runAll() {
  await Promise.all([reminderTick(), recurringTick(), taskTick()]);
}

module.exports = { runAll };
