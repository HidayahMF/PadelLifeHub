// One-off cleanup: deactivate Reminder docs that are linked (type='task' /
// 'goal' + relatedId) to an entity that is missing, completed, archived or
// trashed. Such reminders would otherwise fire a notification forever even
// though their task/goal no longer needs one.
//
// Default: deactivate (active:false, sent:true) — reversible, keeps the row
// visible in the calendar but inert. Pass --delete to hard-delete instead.
//
// Usage: node scripts/cleanup-orphan-reminders.js [--delete]

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Reminder = require('../models/Reminder');
const Task = require('../models/Task');
const Goal = require('../models/Goal');

const HARD_DELETE = process.argv.includes('--delete');

async function staleByEntity(Model, type) {
  const linked = await Reminder.find({ type, relatedId: { $ne: null } });
  if (!linked.length) {
    console.log(`[cleanup] no ${type}-linked reminders`);
    return { stale: [], all: linked };
  }
  const ids = [...new Set(linked.map((r) => String(r.relatedId)))];
  const docs = await Model.find({ _id: { $in: ids } });
  const liveIds = new Set(
    docs
      .filter(
        (d) =>
          d.status !== 'completed' &&
          d.completed !== true &&
          !d.archived &&
          !d.trashed
      )
      .map((d) => String(d._id))
  );
  const stale = linked.filter((r) => !liveIds.has(String(r.relatedId)));
  return { stale, all: linked };
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  await connectDB();

  for (const [Model, type] of [
    [Task, 'task'],
    [Goal, 'goal'],
  ]) {
    const { stale, all } = await staleByEntity(Model, type);
    if (!stale.length) {
      console.log(`[cleanup] ${type}: 0 stale of ${all.length} linked — nothing to do`);
      continue;
    }
    const ids = stale.map((r) => r._id);
    if (HARD_DELETE) {
      await Reminder.deleteMany({ _id: { $in: ids } });
      console.log(`[cleanup] ${type}: DELETED ${ids.length} orphan reminders`);
    } else {
      await Reminder.updateMany(
        { _id: { $in: ids } },
        { $set: { active: false, sent: true } }
      );
      console.log(`[cleanup] ${type}: DEACTIVATED ${ids.length} orphan reminders`);
    }
  }

  await mongoose.disconnect();
  console.log('[cleanup] done');
}

run().catch((err) => {
  console.error('cleanup failed:', err.message);
  process.exit(1);
});
