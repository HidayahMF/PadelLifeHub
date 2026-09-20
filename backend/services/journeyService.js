const User = require('../models/User');
const Note = require('../models/Note');
const Task = require('../models/Task');
const Goal = require('../models/Goal');
const Habit = require('../models/Habit');
const Transaction = require('../models/Transaction');
const FocusSession = require('../models/FocusSession');

/** Preserve the first recorded activity even when several creates race. */
async function recordFirstActivity(userId, createdAt = new Date()) {
  if (typeof User.updateOne !== 'function') return;
  try {
    await User.updateOne(
      { _id: userId, firstActivityAt: null },
      { $set: { firstActivityAt: createdAt } }
    );
  } catch (err) {
    // The activity is already committed; metadata failure must not reject it.
    console.error(`[journey] first activity update failed: ${err.message}`);
  }
}

async function oldestDate(model, filter, field = 'createdAt') {
  const row = await model.findOne(filter).sort({ [field]: 1 }).select(field).lean();
  return row?.[field] ? new Date(row[field]) : null;
}

async function getReconstructedFirstActivity(userId) {
  const dates = await Promise.all([
    oldestDate(Note, { user: userId }, 'createdAt'),
    oldestDate(Task, { user: userId, recurrenceId: null }, 'createdAt'),
    oldestDate(Goal, { user: userId }, 'createdAt'),
    oldestDate(Habit, { user: userId }, 'createdAt'),
    oldestDate(Transaction, { user: userId, parentRecurringId: null }, 'createdAt'),
    oldestDate(FocusSession, { user: userId }, 'createdAt'),
  ]);
  return dates.filter(Boolean).sort((a, b) => a - b)[0] ?? null;
}

function dayKey(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Add a verifiable activity date once, using the application's WIB calendar. */
function addActivityDay(days, value) {
  const key = dayKey(value);
  if (key) days.add(key);
}

/**
 * Build the active-day set from already scoped records. Scheduler-created
 * recurring children are excluded from their creation date; a completed child
 * still contributes its explicit completedAt because that proves user action.
 */
function collectActiveDays({ notes = [], tasks = [], goals = [], habits = [], transactions = [], focusSessions = [] }) {
  const days = new Set();
  notes.forEach((item) => addActivityDay(days, item.createdAt));
  tasks.forEach((item) => {
    if (!item.recurrenceId) addActivityDay(days, item.createdAt);
    if (item.status === 'completed' && item.completedAt) addActivityDay(days, item.completedAt);
  });
  goals.forEach((item) => addActivityDay(days, item.createdAt));
  habits.forEach((item) => {
    addActivityDay(days, item.createdAt);
    (item.completedDates || []).forEach((date) => addActivityDay(days, date));
  });
  transactions.forEach((item) => {
    if (!item.parentRecurringId) addActivityDay(days, item.createdAt);
  });
  focusSessions.forEach((item) => addActivityDay(days, item.startTime || item.createdAt));
  return days;
}

async function getJourney(userId) {
  const user = await User.findById(userId).select('createdAt firstActivityAt').lean();
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const [notesCreated, tasksCompleted, goalsCompleted, ...activityResults] = await Promise.all([
    Note.countDocuments({ user: userId, trashed: { $ne: true } }),
    Task.countDocuments({ user: userId, status: 'completed', trashed: { $ne: true } }),
    Goal.countDocuments({ user: userId, completed: true, trashed: { $ne: true } }),
    Note.find({ user: userId, trashed: { $ne: true } }).select('createdAt').lean(),
    Task.find({ user: userId, trashed: { $ne: true } }).select('createdAt completedAt status recurrenceId').lean(),
    Goal.find({ user: userId, trashed: { $ne: true } }).select('createdAt completed').lean(),
    Habit.find({ user: userId }).select('createdAt completedDates').lean(),
    Transaction.find({ user: userId }).select('createdAt parentRecurringId').lean(),
    FocusSession.find({ user: userId }).select('createdAt startTime status').lean(),
  ]);

  const [notes, tasks, goals, habits, transactions, focusSessions] = activityResults;
  const activeDays = collectActiveDays({ notes, tasks, goals, habits, transactions, focusSessions });

  const recordedFirstActivityAt = user.firstActivityAt ? new Date(user.firstActivityAt) : null;
  const reconstructedFirstActivityAt = recordedFirstActivityAt ? null : await getReconstructedFirstActivity(userId);
  const firstActivityAt = recordedFirstActivityAt || reconstructedFirstActivityAt;

  return {
    joinedAt: user.createdAt,
    firstActivityAt,
    firstActivitySource: recordedFirstActivityAt ? 'recorded' : reconstructedFirstActivityAt ? 'reconstructed' : null,
    statistics: {
      notesCreated,
      tasksCompleted,
      goalsCompleted,
      activeDays: activeDays.size,
    },
  };
}

module.exports = { recordFirstActivity, getJourney, dayKey, collectActiveDays };
