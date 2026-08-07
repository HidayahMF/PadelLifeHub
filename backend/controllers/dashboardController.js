const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Goal = require('../models/Goal');

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
      }).sort({ priority: 1 }),
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

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
              dueDate: { $gte: weekStart },
            }),
          ]);

        const weeklyActivity = [];
        for (let i = 0; i < 7; i++) {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + i);
          const nextDay = new Date(day);
          nextDay.setDate(nextDay.getDate() + 1);
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
        const [totalIncome, totalExpense, categorySpending, monthlyCashFlow] =
          await Promise.all([
            Transaction.aggregate([
              { $match: { user: userId, type: 'income' } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
              { $match: { user: userId, type: 'expense' } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
              {
                $match: {
                  user: userId,
                  type: 'expense',
                  date: { $gte: monthStart, $lt: nextMonth },
                },
              },
              {
                $group: {
                  _id: '$category',
                  total: { $sum: '$amount' },
                },
              },
            ]),
            Transaction.aggregate([
              {
                $match: { user: userId, date: { $gte: monthStart, $lt: nextMonth } },
              },
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
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

        return {
          totalIncome: totalIncome[0]?.total || 0,
          totalExpense: totalExpense[0]?.total || 0,
          balance: (totalIncome[0]?.total || 0) - (totalExpense[0]?.total || 0),
          categorySpending,
          monthlyCashFlow,
        };
      })(),
    ]);

    res.json({ productivity, finance });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardSummary, getStatistics };
