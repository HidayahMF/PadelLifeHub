// Reminder scheduler — runs inside the backend process and processes due
// reminders + task reminders, creating in-app Notifications.
// Uses atomic claim updates so concurrent ticks can never double-send.

const Reminder = require('../models/Reminder');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');
const Habit = require('../models/Habit');
const User = require('../models/User');
const { sendNotification } = require('./emailService');

const TICK_MS = 30 * 1000;

/**
 * Create an in-app notification and, when the user enabled email updates,
 * also send it as an email. Both are best-effort and never throw.
 */
async function notify(userId, { type, title, message, relatedId }) {
  await Notification.create({ user: userId, title, message, type, relatedId });

  try {
    const settings = await Setting.findOne({ user: userId });
    if (settings && settings.notifications && settings.notifications.emailUpdates) {
      const user = await User.findById(userId).select('email');
      if (user && user.email) {
        await sendNotification(user.email, { subject: title, message });
      }
    }
  } catch (err) {
    console.error(`[scheduler] email notify failed for ${userId}: ${err.message}`);
  }
}

/** Advance a datetime by the recurring frequency. */
function nextOccurrence(datetime, frequency) {
  const d = new Date(datetime);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d;
}

const TYPE_TO_SETTING_KEY = {
  task: 'taskReminders',
  bill: 'billReminders',
  habit: 'habitReminders',
};

async function processDueReminder() {
  const now = new Date();
  const due = await Reminder.find({
    sent: false,
    datetime: { $lte: now },
  }).limit(200);

  for (const reminder of due) {
    // Atomically claim this occurrence (idempotency guard).
    const claimed = await Reminder.findOneAndUpdate(
      { _id: reminder._id, sent: false },
      { $set: { sent: true } },
      { new: true }
    );
    if (!claimed) continue;

    const settingKey = TYPE_TO_SETTING_KEY[claimed.type];
    let notificationsEnabled = true;
    if (settingKey) {
      const settings = await Setting.findOne({ user: claimed.user });
      notificationsEnabled = !(
        settings &&
        settings.notifications &&
        settings.notifications[settingKey] === false
      );
    }

    if (notificationsEnabled) {
      await notify(claimed.user, {
        type: claimed.type === 'task' ? 'task' : 'reminder',
        title: claimed.title,
        message: `Reminder${claimed.recurring?.isRecurring ? ' (recurring)' : ''} — ${claimed.title}`,
        relatedId: claimed.relatedId || claimed._id,
      });
    }

    // Recurring: advance to the next occurrence and re-arm.
    if (claimed.recurring && claimed.recurring.isRecurring) {
      claimed.datetime = nextOccurrence(claimed.datetime, claimed.recurring.frequency || 'monthly');
      claimed.sent = false;
      await claimed.save();
    }
  }
}

/**
 * Milestone notifications — budget warnings (80%/100%), habit streaks
 * (7/30/100 days) and goal progress milestones (50%/100%). Each is emitted
 * at most once per milestone via relatedId-based dedup checks, so restarts
 * can never spam duplicates.
 */
async function processMilestones() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Budget warnings — once per budget per month.
  const budgets = await Budget.find({
    amount: { $gt: 0 },
    $expr: { $gte: [{ $divide: ['$spent', '$amount'] }, 0.8] },
  }).populate('category', 'name');
  for (const budget of budgets) {
    const existing = await Notification.findOne({
      user: budget.user,
      type: 'bill',
      relatedId: budget._id,
      createdAt: { $gte: monthStart },
    });
    if (existing) continue;
    const pct = Math.min(100, Math.round((budget.spent / budget.amount) * 100));
    const name = budget.category?.name ?? 'Overall';
    await notify(budget.user, {
      title: pct >= 100 ? 'Budget exceeded' : `${name} budget ${pct}% used`,
      message: `${name} — ${pct}% of your budget is used (${Math.round(budget.spent).toLocaleString()} / ${Math.round(budget.amount).toLocaleString()}).`,
      type: 'bill',
      relatedId: budget._id,
    });
  }

  // Habit streaks — once per streak value.
  const habits = await Habit.find({
    archived: { $ne: true },
    streak: { $in: [7, 30, 100] },
  });
  for (const habit of habits) {
    const existing = await Notification.findOne({
      user: habit.user,
      type: 'habit',
      relatedId: habit._id,
      message: new RegExp(`${habit.streak}-day streak`),
    });
    if (existing) continue;
    await notify(habit.user, {
      title: `${habit.streak}-day habit streak! 🔥`,
      message: `${habit.name} — ${habit.streak}-day streak. Keep it up!`,
      type: 'habit',
      relatedId: habit._id,
    });
  }

  // Goal milestones — once per threshold reached.
  const goals = await Goal.find({ completed: false, target: { $gt: 0 }, progress: { $gt: 0 } });
  for (const goal of goals) {
    const pct = Math.min(100, Math.round((goal.progress / goal.target) * 100));
    if (pct < 50) continue;
    const thresholds = pct >= 100 ? [100] : [50];
    for (const threshold of thresholds) {
      const existing = await Notification.findOne({
        user: goal.user,
        type: 'system',
        relatedId: goal._id,
        title: new RegExp(`${threshold}%`),
      });
      if (existing) continue;
      await notify(goal.user, {
        title: `Goal ${threshold}% reached 🎯`,
        message: `${goal.title} is ${pct}% complete.`,
        type: 'system',
        relatedId: goal._id,
      });
    }
  }
}

async function processDueTaskReminders() {
  const now = new Date();
  const dueTasks = await Task.find({
    reminder: { $ne: null, $lte: now },
    reminderSentAt: null,
    status: { $ne: 'completed' },
    archived: { $ne: true },
  }).limit(200);

  for (const task of dueTasks) {
    // Atomically claim so a reminder is only ever notified once per value.
    const claimed = await Task.findOneAndUpdate(
      { _id: task._id, reminderSentAt: null, reminder: task.reminder },
      { $set: { reminderSentAt: now } },
      { new: true }
    );
    if (!claimed) continue;

    const settings = await Setting.findOne({ user: claimed.user });
    if (settings && settings.notifications && settings.notifications.taskReminders === false) {
      continue;
    }

    await notify(claimed.user, {
      type: 'task',
      title: claimed.title,
      message: `Task due reminder — ${claimed.title}`,
      relatedId: claimed._id,
    });
  }
}

async function tick() {
  try {
    await Promise.all([processDueReminder(), processDueTaskReminders(), processMilestones()]);
  } catch (err) {
    // Never crash the server because of a scheduler error.
    console.error(`[scheduler] error: ${err.message}`);
  }
}

let interval = null;

function startReminderScheduler() {
  if (interval) return;
  tick();
  interval = setInterval(tick, TICK_MS);
  console.log('[scheduler] reminder scheduler started');
}

module.exports = { startReminderScheduler, tick };
