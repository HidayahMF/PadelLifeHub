// Financial Insights — deterministic, computed entirely from the user's own
// transactions and budgets in MongoDB. No external/AI APIs.
// Transfers (type 'transfer') are never counted as income or expense here.

const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const { startOfLocalDay, addLocalDays } = require('../utils/date');

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const getInsights = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const today = startOfLocalDay(now);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = thisMonthStart;
    const windowStart = addLocalDays(today, -29);
    const windowEnd = addLocalDays(today, 1);

    const [thisMonth, lastMonth, cashFlow, recent, budgets, categories] = await Promise.all([
      Transaction.aggregate([
        { $match: { user: userId, date: { $gte: thisMonthStart, $lt: thisMonthEnd } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { user: userId, date: { $gte: lastMonthStart, $lt: lastMonthEnd } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'Asia/Jakarta' } },
            income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.find({
        user: userId,
        date: { $gte: windowStart, $lt: windowEnd },
      }).populate('category', 'name color icon'),
      Budget.find({ user: userId, month: monthKeyOf(now) }).populate('category', 'name color icon'),
      Category.find({ user: userId, type: 'transaction' }),
    ]);

    const sum = (rows, type) => rows.find((r) => r._id === type)?.total ?? 0;
    const thisIncome = sum(thisMonth, 'income');
    const thisExpense = sum(thisMonth, 'expense');
    const lastIncome = sum(lastMonth, 'income');
    const lastExpense = sum(lastMonth, 'expense');

    const savingsRate = thisIncome > 0 ? ((thisIncome - thisExpense) / thisIncome) * 100 : 0;
    const savingsRateLastMonth =
      lastIncome > 0 ? ((lastIncome - lastExpense) / lastIncome) * 100 : 0;

    // Spending by category over the last 30 days.
    const categoryTotals = new Map();
    for (const txn of recent) {
      if (txn.type !== 'expense') continue;
      const cat = txn.category && typeof txn.category === 'object' ? txn.category : null;
      const key = cat ? cat._id.toString() : 'uncategorized';
      const entry = categoryTotals.get(key) ?? {
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? 'var(--color-ink-faint)',
        total: 0,
      };
      entry.total += txn.amount;
      categoryTotals.set(key, entry);
    }
    const totalWindowSpend = [...categoryTotals.values()].reduce((s, c) => s + c.total, 0);
    const spendingByCategory = [...categoryTotals.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, pct: totalWindowSpend ? (c.total / totalWindowSpend) * 100 : 0 }));
    const largestCategory = spendingByCategory[0] ?? null;

    // Month-over-month comparison.
    const spentDiff = thisExpense - lastExpense;
    const spentPct = lastExpense > 0 ? (spentDiff / lastExpense) * 100 : 0;

    // Budget adherence.
    const totalBudget = budgets.reduce((s, b) => s + (b.amount || 0), 0);
    const totalBudgetSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);
    const overBudget = budgets
      .filter((b) => b.spent > b.amount)
      .map((b) => (b.category && typeof b.category === 'object' ? b.category.name : 'Overall'));

    // Weekend vs weekday average daily spending (last 30 days).
    let weekendSpend = 0;
    let weekdaySpend = 0;
    let weekendDays = 0;
    let weekdayDays = 0;
    for (let i = 0; i < 30; i++) {
      const day = addLocalDays(windowStart, i);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) weekendDays += 1;
      else weekdayDays += 1;
    }
    for (const txn of recent) {
      if (txn.type !== 'expense') continue;
      const dow = new Date(txn.date).getDay();
      if (dow === 0 || dow === 6) weekendSpend += txn.amount;
      else weekdaySpend += txn.amount;
    }

    // Cash flow: last 6 months including the current one.
    const last6 = cashFlow.slice(-6).map((p) => ({
      ...p,
      net: (p.income || 0) - (p.expense || 0),
    }));

    res.json({
      month: monthKeyOf(now),
      income: { thisMonth: thisIncome, lastMonth: lastIncome },
      expense: { thisMonth: thisExpense, lastMonth: lastExpense },
      savingsRate,
      savingsRateLastMonth,
      spendingByCategory,
      largestCategory,
      monthOverMonth: { spent: thisExpense, lastMonthSpent: lastExpense, diff: spentDiff, pct: spentPct },
      budget: {
        totalBudget,
        totalSpent: totalBudgetSpent,
        pct: totalBudget ? (totalBudgetSpent / totalBudget) * 100 : 0,
        count: budgets.length,
        overBudget,
      },
      cashFlow: last6,
      weekendVsWeekday: {
        weekendAvg: weekendDays ? weekendSpend / weekendDays : 0,
        weekdayAvg: weekdayDays ? weekdaySpend / weekdayDays : 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getInsights };
