// Today / Daily Planner — one aggregated endpoint powering the /today page.
// Reuses existing data sources (tasks, habits, goals, transactions, reminders)
// with WIB-safe day boundaries so nothing drifts across the UTC+7 line.

const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const Habit = require('../models/Habit');
const Goal = require('../models/Goal');
const Reminder = require('../models/Reminder');
const { startOfLocalDay, addLocalDays, getTodayLocalDate } = require('../utils/date');

const getToday = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const today = startOfLocalDay(now);
    const tomorrow = addLocalDays(today, 1);
    const todayStr = getTodayLocalDate();

    const [
      focusTasks,
      overdueTasks,
      completedToday,
      habits,
      upcomingReminders,
      upcomingTasks,
      goals,
      todayTransactions,
    ] = await Promise.all([
      // Open tasks due today — the day's focus list.
      Task.find({
        user: userId,
        dueDate: { $gte: today, $lt: tomorrow },
        status: { $ne: 'completed' },
        archived: { $ne: true },
      })
        .sort({ pinned: -1, dueDate: 1 })
        .populate('category', 'name color icon'),
      // Overdue tasks that still need attention.
      Task.find({
        user: userId,
        dueDate: { $lt: today },
        status: { $ne: 'completed' },
        archived: { $ne: true },
      })
        .sort({ dueDate: 1 })
        .limit(10)
        .populate('category', 'name color icon'),
      Task.countDocuments({
        user: userId,
        status: 'completed',
        completedAt: { $gte: today, $lt: tomorrow },
        dueDate: { $gte: today, $lt: tomorrow },
        archived: { $ne: true },
      }),
      Habit.find({ user: userId, archived: { $ne: true } }).sort({ createdAt: 1 }),
      Reminder.find({ user: userId, datetime: { $gte: now } })
        .sort({ datetime: 1 })
        .limit(6),
      Task.find({
        user: userId,
        dueDate: { $gte: tomorrow },
        status: { $ne: 'completed' },
        archived: { $ne: true },
      })
        .sort({ dueDate: 1 })
        .limit(6)
        .populate('category', 'name color icon'),
      Goal.find({ user: userId, completed: false }).sort({ deadline: 1 }).limit(5),
      Transaction.find({ user: userId, date: { $gte: today, $lt: tomorrow } }),
    ]);

    let income = 0;
    let expense = 0;
    for (const txn of todayTransactions) {
      if (txn.type === 'income') income += txn.amount;
      else if (txn.type === 'expense') expense += txn.amount;
      // transfers are intentionally excluded from cash flow
    }

    const habitsToday = habits.map((habit) => ({
      ...habit.toObject(),
      doneToday: (habit.completedDates || []).includes(todayStr),
    }));

    const habitsDone = habitsToday.filter((h) => h.doneToday).length;

    res.json({
      date: todayStr,
      focus: focusTasks,
      overdue: overdueTasks,
      completedToday,
      habits: habitsToday,
      finance: { income, expense, net: income - expense },
      upcomingReminders,
      upcomingTasks,
      goals,
      progress: {
        totalTasksToday: focusTasks.length + completedToday,
        completedTasksToday: completedToday,
        habitsTotal: habitsToday.length,
        habitsDone,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getToday };
