// Recurring task scheduler — turns a recurring task (parent) into fresh child
// tasks at each due occurrence, with the same idempotency guarantees as the
// recurring transaction scheduler:
//  - the parent's nextOccurrence is claimed atomically BEFORE a child is
//    created, so a tick restart can never generate a duplicate;
//  - a sparse unique index on (user + recurrenceId + dueDate) backs that up.

const Task = require('../models/Task');

const TICK_MS = 60 * 1000;

/** Advance a datetime by the recurring frequency (clamped to month end). */
function nextOccurrence(datetime, frequency, daysOfWeek) {
  const d = new Date(datetime);

  if (frequency === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (frequency === 'weekly' && Array.isArray(daysOfWeek) && daysOfWeek.length) {
    // Custom weekly: advance to the next date matching one of the chosen days.
    const daySet = new Set(daysOfWeek.map(Number));
    d.setDate(d.getDate() + 1);
    while (!daySet.has(d.getDay())) d.setDate(d.getDate() + 1);
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'monthly') {
    const day = d.getDate();
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    d.setFullYear(next.getFullYear());
    d.setMonth(next.getMonth());
    d.setDate(Math.min(day, lastDay));
  } else if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

/** First occurrence for a task created with recurrence, based on its due date. */
function computeFirstOccurrence(dueDate, recurring) {
  if (!recurring || !recurring.isRecurring) return null;
  const base = dueDate ? new Date(dueDate) : new Date();
  return nextOccurrence(base, recurring.frequency || 'monthly', recurring.daysOfWeek);
}

async function processDueRecurringTasks() {
  const now = new Date();
  const parents = await Task.find({
    'recurring.isRecurring': true,
    nextOccurrence: { $lte: now },
    archived: { $ne: true },
  }).limit(200);

  for (const parent of parents) {
    const occurrenceDate = new Date(parent.nextOccurrence);
    const frequency = parent.recurring.frequency || 'monthly';

    // Atomic claim: advance the schedule immediately.
    const claimed = await Task.findOneAndUpdate(
      {
        _id: parent._id,
        'recurring.isRecurring': true,
        nextOccurrence: parent.nextOccurrence,
      },
      {
        $set: {
          nextOccurrence: nextOccurrence(occurrenceDate, frequency, parent.recurring.daysOfWeek),
          lastGeneratedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!claimed) continue;

    // Second idempotency guard (backed by the sparse unique index).
    const existing = await Task.findOne({
      user: parent.user,
      recurrenceId: parent._id,
      dueDate: occurrenceDate,
    });
    if (existing) continue;

    try {
      await Task.create({
        user: parent.user,
        title: parent.title,
        description: parent.description,
        category: parent.category,
        priority: parent.priority,
        pinned: false,
        status: 'todo',
        dueDate: occurrenceDate,
        reminder: null,
        recurring: { isRecurring: false, frequency: 'none', daysOfWeek: [] },
        recurrenceId: parent._id,
      });
      console.log(`[scheduler] recurring task generated: ${parent.title}`);
    } catch (err) {
      // Duplicate-key errors are expected on race — harmless.
      if (err?.code !== 11000) {
        console.error(`[scheduler] recurring task generation failed: ${err.message}`);
      }
    }
  }
}

async function tick() {
  try {
    await processDueRecurringTasks();
  } catch (err) {
    console.error(`[scheduler] recurring task error: ${err.message}`);
  }
}

let interval = null;

function startTaskScheduler() {
  if (interval) return;
  tick();
  interval = setInterval(tick, TICK_MS);
  console.log('[scheduler] recurring task scheduler started');
}

module.exports = { startTaskScheduler, nextOccurrence, computeFirstOccurrence };
