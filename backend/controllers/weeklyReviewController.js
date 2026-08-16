// Weekly Review — deterministic weekly stats + user reflection, all computed
// from the user's own data with WIB-safe week boundaries (Mon → Sun).

const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const Habit = require('../models/Habit');
const Goal = require('../models/Goal');
const WeeklyReview = require('../models/WeeklyReview');
const Category = require('../models/Category');
const { focusTotals } = require('./focusSessionController');
const { startOfLocalDay, addLocalDays, formatLocalDate } = require('../utils/date');

/** Monday (local WIB) of the week containing `date`. */
function weekStartOf(date = new Date()) {
  const d = startOfLocalDay(date);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return d;
}

const getWeeklyReview = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const weekStart = weekStartOf(now);
    const weekEnd = addLocalDays(weekStart, 7);

    const [saved, productivity, habits, finance, goals, focus, categories] = await Promise.all([
      WeeklyReview.findOne({ user: userId, weekStart }),
      (async () => {
        const [completed, created, dueInWeek, overdue] = await Promise.all([
          Task.countDocuments({
            user: userId,
            status: 'completed',
            completedAt: { $gte: weekStart, $lt: weekEnd },
            archived: { $ne: true },
          }),
          Task.countDocuments({
            user: userId,
            createdAt: { $gte: weekStart, $lt: weekEnd },
            archived: { $ne: true },
          }),
          Task.find({
            user: userId,
            dueDate: { $gte: weekStart, $lt: weekEnd },
            archived: { $ne: true },
          }),
          Task.countDocuments({
            user: userId,
            dueDate: { $lt: now },
            status: { $ne: 'completed' },
            archived: { $ne: true },
          }),
        ]);
        const completionRate =
          dueInWeek.length > 0
            ? Math.round(
                (dueInWeek.filter((t) => t.status === 'completed').length / dueInWeek.length) * 100
              )
            : 0;
        return { completed, created, completionRate, overdue };
      })(),
      (async () => {
        const habits = await Habit.find({ user: userId, archived: { $ne: true } });
        let bestStreak = 0;
        const completionRates = [];
        for (const habit of habits) {
          bestStreak = Math.max(bestStreak, Number(habit.bestStreak) || 0);
          const done = (habit.completedDates || []).filter((d) => {
            const day = new Date(`${d}T00:00:00`);
            return day >= weekStart && day < weekEnd;
          }).length;
          // Daily habits: 7 possible days. Weekly/monthly: 1 possible slot.
          const possible = habit.frequency === 'daily' ? 7 : 1;
          completionRates.push(Math.min(100, (done / possible) * 100));
        }
        return {
          bestStreak,
          averageCompletion: completionRates.length
            ? Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length)
            : 0,
          tracked: habits.length,
        };
      })(),
      (async () => {
        const [income, expense] = await Promise.all([
          Transaction.aggregate([
            {
              $match: { user: userId, type: 'income', date: { $gte: weekStart, $lt: weekEnd } },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]),
          Transaction.aggregate([
            {
              $match: { user: userId, type: 'expense', date: { $gte: weekStart, $lt: weekEnd } },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]),
        ]);
        const totalIncome = income[0]?.total ?? 0;
        const totalExpense = expense[0]?.total ?? 0;
        return { income: totalIncome, expense: totalExpense, saved: totalIncome - totalExpense };
      })(),
      (async () => {
        const progressed = await Goal.countDocuments({
          user: userId,
          updatedAt: { $gte: weekStart, $lt: weekEnd },
          progress: { $gt: 0 },
        });
        const completed = await Goal.countDocuments({
          user: userId,
          completed: true,
          updatedAt: { $gte: weekStart, $lt: weekEnd },
        });
        return { progressed, completed };
      })(),
      focusTotals(userId, weekStart, weekEnd),
      Category.find({ user: userId, type: 'transaction' }),
    ]);

    // Top spending category in the reviewed week.
    const weekTransactions = await Transaction.find({
      user: userId,
      type: 'expense',
      date: { $gte: weekStart, $lt: weekEnd },
    });
    const byCategory = new Map();
    for (const txn of weekTransactions) {
      const cat = txn.category && typeof txn.category === 'object' ? txn.category : null;
      const key = cat ? cat._id.toString() : 'uncategorized';
      byCategory.set(key, (byCategory.get(key) ?? 0) + txn.amount);
    }
    let topCategory = null;
    for (const [key, total] of byCategory) {
      const cat = categories.find((c) => c._id.toString() === key);
      const name = cat?.name ?? 'Uncategorized';
      if (!topCategory || total > topCategory.total) topCategory = { name, total };
    }

    res.json({
      weekStart,
      weekEnd,
      weekLabel: `${formatLocalDate(weekStart)} — ${formatLocalDate(addLocalDays(weekEnd, -1))}`,
      productivity,
      habits,
      finance,
      goals,
      focus,
      topCategory,
      reflection: {
        wentWell: saved?.wentWell ?? '',
        improve: saved?.improve ?? '',
      },
    });
  } catch (err) {
    next(err);
  }
};

const saveWeeklyReview = async (req, res, next) => {
  try {
    const weekStart = req.body.weekStart ? new Date(req.body.weekStart) : weekStartOf();
    const userId = req.user._id;

    const review = await WeeklyReview.findOneAndUpdate(
      { user: userId, weekStart },
      {
        $set: {
          wentWell: String(req.body.wentWell ?? ''),
          improve: String(req.body.improve ?? ''),
        },
      },
      { upsert: true, new: true }
    );
    res.json(review);
  } catch (err) {
    next(err);
  }
};

module.exports = { getWeeklyReview, saveWeeklyReview, weekStartOf };
