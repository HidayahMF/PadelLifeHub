const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Goal = require('../models/Goal');
const { startOfLocalDay, addLocalDays } = require('../utils/date');

/** Resolve a statistics range to { start, end } local dates (null = unbounded). */
function resolveRange(range) {
  const now = new Date();
  const today = startOfLocalDay(now);
  switch (range) {
    case '7d':
      return { start: addLocalDays(today, -6), end: addLocalDays(today, 1) };
    case '30d':
      return { start: addLocalDays(today, -29), end: addLocalDays(today, 1) };
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start, end: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
    case 'thisYear':
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear() + 1, 0, 1),
      };
    case 'all':
      return { start: null, end: null };
    case 'thisMonth':
    default:
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
  }
}

const getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [
      totalTasks,
      completedTasks,
      todayTasks,
      upcomingDeadlines,
      totalIncome,
      totalExpense,
      monthIncome,
      monthExpense,
      totalBalance,
      recentTransactions,
      activeGoals,
    ] = await Promise.all([
      Task.countDocuments({ user: userId, archived: { $ne: true } }),
      Task.countDocuments({ user: userId, status: 'completed' }),
      Task.find({
        user: userId,
        dueDate: { $gte: today, $lt: tomorrow },
        archived: { $ne: true },
      }).sort({ pinned: -1, dueDate: 1 }),
      Task.find({
        user: userId,
        dueDate: { $gte: tomorrow },
        status: { $ne: 'completed' },
        archived: { $ne: true },
      })
        .sort({ dueDate: 1 })
        .limit(5),
      Transaction.aggregate([
        { $match: { user: userId, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { user: userId, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { user: userId, type: 'income', date: { $gte: monthStart, $lt: nextMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { user: userId, type: 'expense', date: { $gte: monthStart, $lt: nextMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Account.aggregate([
        { $match: { user: userId } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
      ]),
      Transaction.find({ user: userId })
        .sort({ date: -1 })
        .limit(10)
        .populate('category', 'name color icon')
        .populate('account', 'name type'),
      Goal.find({ user: userId, completed: false }).sort({ deadline: 1 }).limit(5),
    ]);

    res.json({
      taskSummary: {
        total: totalTasks,
        completed: completedTasks,
        pending: totalTasks - completedTasks,
        today: todayTasks,
        upcoming: upcomingDeadlines,
      },
      financeSummary: {
        totalIncome: totalIncome[0]?.total || 0,
        totalExpense: totalExpense[0]?.total || 0,
        monthIncome: monthIncome[0]?.total || 0,
        monthExpense: monthExpense[0]?.total || 0,
        balance: totalBalance[0]?.total || 0,
      },
      recentTransactions,
      activeGoals,
    });
  } catch (err) {
    next(err);
  }
};

const getStatistics = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const range = String(req.query.range || 'thisMonth');
    const { start: rangeStart, end: rangeEnd } = resolveRange(range);
    const dateFilter = rangeStart ? { date: { $gte: rangeStart, $lt: rangeEnd } } : {};

    const today = startOfLocalDay(new Date());
    const weekStart = addLocalDays(today, -today.getDay());
    const weekEnd = addLocalDays(weekStart, 7);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [productivity, finance] = await Promise.all([
      (async () => {
        const [totalTasks, completedTasks, weeklyCompleted, monthlyCompleted, weeklyActive] =
          await Promise.all([
            Task.countDocuments({ user: userId }),
            Task.countDocuments({ user: userId, status: 'completed' }),
            Task.countDocuments({
              user: userId,
              status: 'completed',
              completedAt: { $gte: weekStart },
            }),
            Task.countDocuments({
              user: userId,
              status: 'completed',
              completedAt: { $gte: monthStart, $lt: nextMonth },
            }),
            Task.find({
              user: userId,
              status: { $ne: 'completed' },
              dueDate: { $gte: weekStart, $lt: weekEnd },
            }),
          ]);

        const weeklyActivity = [];
        for (let i = 0; i < 7; i++) {
          const day = addLocalDays(weekStart, i);
          const nextDay = addLocalDays(day, 1);
          weeklyActivity.push({
            date: day,
            completed: await Task.countDocuments({
              user: userId,
              status: 'completed',
              completedAt: { $gte: day, $lt: nextDay },
            }),
          });
        }

        return {
          totalTasks,
          completedTasks,
          pendingTasks: totalTasks - completedTasks,
          weeklyCompleted,
          monthlyCompleted,
          weeklyActive,
          weeklyActivity,
        };
      })(),
      (async () => {
        const groupByDay = range === '7d' || range === '30d';
        const dateFormat = groupByDay ? '%Y-%m-%d' : '%Y-%m';

        const [totalIncome, totalExpense, categorySpending, cashFlow] =
          await Promise.all([
            Transaction.aggregate([
              { $match: { user: userId, type: 'income', ...dateFilter } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
              { $match: { user: userId, type: 'expense', ...dateFilter } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
              {
                $match: { user: userId, type: 'expense', ...dateFilter },
              },
              {
                $group: {
                  _id: '$category',
                  total: { $sum: '$amount' },
                },
              },
              { $sort: { total: -1 } },
            ]),
            Transaction.aggregate([
              { $match: { user: userId, ...dateFilter } },
              {
                $group: {
                  // Group in the application timezone so WIB-midnight-stored
                  // dates land on the correct calendar day/month.
                  _id: {
                    $dateToString: {
                      format: dateFormat,
                      date: '$date',
                      timezone: 'Asia/Jakarta',
                    },
                  },
                  income: {
                    $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
                  },
                  expense: {
                    $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
                  },
                },
              },
              { $sort: { _id: 1 } },
            ]),
          ]);

        // Balance is the current stored account balance — the same source of
        // truth as the Finance dashboard, so the numbers always agree.
        const [accountBalance] = await Account.aggregate([
          { $match: { user: userId } },
          { $group: { _id: null, total: { $sum: '$balance' } } },
        ]);

        return {
          totalIncome: totalIncome[0]?.total || 0,
          totalExpense: totalExpense[0]?.total || 0,
          balance: accountBalance?.total || 0,
          categorySpending,
          monthlyCashFlow: cashFlow,
        };
      })(),
    ]);

    res.json({ productivity, finance });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardSummary, getStatistics };
