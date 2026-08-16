// Financial Insights — deterministic, computed entirely from the user's own
// transactions, accounts and budgets in MongoDB. No external/AI APIs.
// Transfers (type 'transfer') are never counted as income or expense here.

const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Account = require('../models/Account');
const { startOfLocalDay, addLocalDays } = require('../utils/date');

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Transparent Financial Health Score — an informational LifeHub metric, never
 * professional financial advice.
 *
 * Every dimension is 0–100 and carries a weight plus a plain-language reason
 * so the total is fully explainable. When there is no data at all the score
 * is null ("not enough data") instead of a misleading 0.
 */
function computeFinancialHealth({
  thisIncome,
  thisExpense,
  lastIncome,
  lastExpense,
  savingsRate,
  liquidAssets,
  budget,
}) {
  const dims = [];
  const anyIncomeOrExpense = thisIncome > 0 || thisExpense > 0 || lastIncome > 0 || lastExpense > 0;
  if (!anyIncomeOrExpense) return null;

  // 1. Cash flow (25%) — net this month as a share of income.
  let cashFlowScore = 50;
  if (thisIncome > 0) {
    cashFlowScore = clamp(50 + ((thisIncome - thisExpense) / thisIncome) * 50, 0, 100);
  } else if (thisExpense > 0) {
    cashFlowScore = 0; // spending with no recorded income this month
  }
  dims.push({
    key: 'cashFlow',
    label: 'Cash flow',
    score: Math.round(cashFlowScore),
    weight: 25,
    detail:
      thisIncome > 0
        ? `Net cash flow is ${Math.round(((thisIncome - thisExpense) / thisIncome) * 100)}% of this month's income.`
        : thisExpense > 0
          ? "This month's spending has no recorded income."
          : 'No income or expense recorded this month.',
  });

  // 2. Savings behavior (25%) — share of income kept this month.
  const savingsScore = clamp(savingsRate, 0, 100);
  dims.push({
    key: 'savings',
    label: 'Savings behavior',
    score: Math.round(savingsScore),
    weight: 25,
    detail:
      thisIncome > 0
        ? `${savingsRate.toFixed(0)}% of this month's income was not spent.`
        : 'No income recorded this month to measure savings against.',
  });

  // 3. Budget adherence (20%) — 100 minus the share of budget used.
  let budgetScore = 50; // no budgets → neutral, never penalized
  if (budget.count > 0 && budget.totalBudget > 0) {
    budgetScore = clamp(100 - budget.pct, 0, 100);
  }
  dims.push({
    key: 'budget',
    label: 'Budget adherence',
    score: Math.round(budgetScore),
    weight: 20,
    detail:
      budget.count > 0
        ? `${budget.pct.toFixed(0)}% of the monthly budget is used` +
          (budget.overBudget.length > 0 ? ` (over: ${budget.overBudget.join(', ')})` : '') +
          '.'
        : 'No budgets set this month — set one to track adherence.',
  });

  // 4. Liquidity (15%) — how many months of spending liquid assets cover.
  let liquidityScore = 100;
  if (thisExpense > 0) {
    const months = liquidAssets / thisExpense;
    liquidityScore = clamp((months / 3) * 100, 0, 100); // 3 months = full marks
  }
  dims.push({
    key: 'liquidity',
    label: 'Liquidity',
    score: Math.round(liquidityScore),
    weight: 15,
    detail:
      thisExpense > 0
        ? `Liquid assets cover about ${(liquidAssets / thisExpense).toFixed(1)} month(s) of this month's spending.`
        : 'No spending recorded this month — liquidity is untested.',
  });

  // 5. Spending consistency (15%) — month-over-month spending change.
  let consistencyScore = 100;
  if (lastExpense > 0) {
    const change = Math.abs((thisExpense - lastExpense) / lastExpense);
    consistencyScore = clamp(100 - change * 100, 0, 100);
  }
  dims.push({
    key: 'consistency',
    label: 'Spending consistency',
    score: Math.round(consistencyScore),
    weight: 15,
    detail:
      lastExpense > 0
        ? `Spending is ${Math.abs(thisExpense - lastExpense) <= lastExpense * 0.25 ? 'stable' : thisExpense > lastExpense ? 'higher' : 'lower'} vs last month (${Math.round(((thisExpense - lastExpense) / lastExpense) * 100)}%).`
        : 'Not enough history to compare month-over-month spending.',
  });

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  const score = Math.round(
    dims.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight
  );
  return {
    score,
    label: score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs attention',
    dimensions: dims,
    disclaimer: 'Informational LifeHub metric — not financial advice.',
  };
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

    const [thisMonth, lastMonth, cashFlow, recent, budgets, categories, accountBalance] =
      await Promise.all([
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
        Account.aggregate([
          { $match: { user: userId } },
          {
            $group: {
              _id: '$type',
              total: { $sum: '$balance' },
            },
          },
        ]),
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

    // Net worth — authoritative account balances grouped by account type.
    // Liquid = cash + bank + e-wallet; investment is tracked separately.
    const typeTotals = {
      bank: 0,
      ewallet: 0,
      cash: 0,
      investment: 0,
    };
    for (const row of accountBalance) {
      if (row._id in typeTotals) typeTotals[row._id] = row.total;
    }
    const totalBalance = Object.values(typeTotals).reduce((s, v) => s + v, 0);
    const liquidAssets = typeTotals.bank + typeTotals.ewallet + typeTotals.cash;
    const netWorth = {
      total: totalBalance,
      liquid: liquidAssets,
      investment: typeTotals.investment,
      byType: Object.entries(typeTotals).map(([type, balance]) => ({
        type,
        balance,
        pct: totalBalance > 0 ? (balance / totalBalance) * 100 : 0,
      })),
    };

    const financialHealth = computeFinancialHealth({
      thisIncome,
      thisExpense,
      lastIncome,
      lastExpense,
      savingsRate,
      liquidAssets,
      budget: {
        count: budgets.length,
        totalBudget,
        pct: totalBudget ? (totalBudgetSpent / totalBudget) * 100 : 0,
        overBudget,
      },
    });

    res.json({
      netWorth,
      financialHealth,
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

module.exports = { getInsights, computeFinancialHealth };
