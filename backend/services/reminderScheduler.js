// Reminder scheduler — runs inside the backend process and processes due
// reminders + task reminders, creating in-app Notifications.
// Uses atomic claim updates so concurrent ticks can never double-send.

const Reminder = require('../models/Reminder');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');

const TICK_MS = 30 * 1000;

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
      await Notification.create({
        user: claimed.user,
        title: claimed.title,
        message: `Reminder${claimed.recurring?.isRecurring ? ' (recurring)' : ''} — ${claimed.title}`,
        type: claimed.type === 'task' ? 'task' : 'reminder',
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

    await Notification.create({
      user: claimed.user,
      title: claimed.title,
      message: `Task due reminder — ${claimed.title}`,
      type: 'task',
      relatedId: claimed._id,
    });
  }
}

async function tick() {
  try {
    await Promise.all([processDueReminder(), processDueTaskReminders()]);
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
