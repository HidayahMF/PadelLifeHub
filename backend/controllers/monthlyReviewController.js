// Monthly Review — deterministic monthly stats + optional AI summary.
//
// Everything numeric is computed server-side from the authenticated user's
// own data (WIB month boundaries, Mon→Sun weeks inside the month). The AI
// summary endpoint only receives these backend-calculated figures so it can
// interpret them without ever inventing numbers.
//
// Transfers (type 'transfer') are never counted as income or expense here.

const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const Habit = require('../models/Habit');
const Goal = require('../models/Goal');
const Account = require('../models/Account');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const { focusTotals } = require('./focusSessionController');
const { generate, isConfigured } = require('../services/geminiService');
const { getUserLanguage } = require('../services/aiContext');
const { startOfLocalDay, addLocalDays, formatLocalDate } = require('../utils/date');

/** YYYY-MM for the current month, used to match Budget.month. */
function monthKeyOf(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Month bounds: { start, end } local dates for the given month key. */
function monthBounds(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

/** Monday (local WIB) of the week containing `date`. */
function weekStartOf(date = new Date()) {
  const d = startOfLocalDay(date);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return d;
}

const getMonthlyReview = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const monthKey = String(req.query.month || monthKeyOf(now));
    const { start: monthStart, end: monthEnd } = monthBounds(monthKey);
    const prevMonthKey = monthKeyOf(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1));
    const { start: prevMonthStart, end: prevMonthEnd } = monthBounds(prevMonthKey);

    const [productivity, habits, finance, goals, focus, topCategories, categories, budgets, netWorth] =
      await Promise.all([
        (async () => {
          const [completed, created, dueInMonth, overdue] = await Promise.all([
            Task.countDocuments({
              user: userId,
              status: 'completed',
              completedAt: { $gte: monthStart, $lt: monthEnd },
              archived: { $ne: true },
            }),
            Task.countDocuments({
              user: userId,
              createdAt: { $gte: monthStart, $lt: monthEnd },
              archived: { $ne: true },
            }),
            Task.find({
              user: userId,
              dueDate: { $gte: monthStart, $lt: monthEnd },
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
            dueInMonth.length > 0
              ? Math.round(
                  (dueInMonth.filter((t) => t.status === 'completed').length / dueInMonth.length) *
                    100
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
              return day >= monthStart && day < monthEnd;
            }).length;
            const daysInMonth = monthEnd - monthStart;
            const possible =
              habit.frequency === 'daily'
                ? Math.round(daysInMonth / 86_400_000)
                : habit.frequency === 'weekly'
                  ? 4
                  : 1;
            completionRates.push(Math.min(100, (done / Math.max(1, possible)) * 100));
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
          const [income, expense, prevIncome, prevExpense] = await Promise.all([
            Transaction.aggregate([
              {
                $match: { user: userId, type: 'income', date: { $gte: monthStart, $lt: monthEnd } },
              },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
              {
                $match: { user: userId, type: 'expense', date: { $gte: monthStart, $lt: monthEnd } },
              },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
              {
                $match: {
                  user: userId,
                  type: 'income',
                  date: { $gte: prevMonthStart, $lt: prevMonthEnd },
                },
              },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
              {
                $match: {
                  user: userId,
                  type: 'expense',
                  date: { $gte: prevMonthStart, $lt: prevMonthEnd },
                },
              },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
          ]);
          const totalIncome = income[0]?.total ?? 0;
          const totalExpense = expense[0]?.total ?? 0;
          const prevTotalIncome = prevIncome[0]?.total ?? 0;
          const prevTotalExpense = prevExpense[0]?.total ?? 0;
          const net = totalIncome - totalExpense;
          const prevNet = prevTotalIncome - prevTotalExpense;
          return {
            income: totalIncome,
            expense: totalExpense,
            saved: net,
            previous: {
              income: prevTotalIncome,
              expense: prevTotalExpense,
              saved: prevNet,
            },
            incomeChangePct:
              prevTotalIncome > 0 ? Math.round(((totalIncome - prevTotalIncome) / prevTotalIncome) * 100) : 0,
            expenseChangePct:
              prevTotalExpense > 0
                ? Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100)
                : 0,
          };
        })(),
        (async () => {
          const progressed = await Goal.countDocuments({
            user: userId,
            updatedAt: { $gte: monthStart, $lt: monthEnd },
            progress: { $gt: 0 },
            archived: { $ne: true },
          });
          const completed = await Goal.countDocuments({
            user: userId,
            completed: true,
            updatedAt: { $gte: monthStart, $lt: monthEnd },
          });
          return { progressed, completed };
        })(),
        focusTotals(userId, monthStart, monthEnd),
        (async () => {
          const rows = await Transaction.aggregate([
            {
              $match: { user: userId, type: 'expense', date: { $gte: monthStart, $lt: monthEnd } },
            },
            {
              $group: { _id: '$category', total: { $sum: '$amount' } },
            },
            { $sort: { total: -1 } },
            { $limit: 5 },
          ]);
          return rows;
        })(),
        Category.find({ user: userId, type: 'transaction' }),
        Budget.find({ user: userId, month: monthKey }),
        (async () => {
          const rows = await Account.aggregate([
            { $match: { user: userId } },
            { $group: { _id: '$type', total: { $sum: '$balance' } } },
          ]);
          const typeTotals = { bank: 0, ewallet: 0, cash: 0, investment: 0 };
          for (const row of rows) {
            if (row._id in typeTotals) typeTotals[row._id] = row.total;
          }
          const total = Object.values(typeTotals).reduce((s, v) => s + v, 0);
          return {
            total,
            liquid: typeTotals.bank + typeTotals.ewallet + typeTotals.cash,
            investment: typeTotals.investment,
            byType: Object.entries(typeTotals).map(([type, balance]) => ({ type, balance })),
          };
        })(),
      ]);

    const topCategoriesResolved = topCategories.map((row) => {
      const cat = categories.find((c) => String(c._id) === String(row._id));
      return {
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? 'var(--color-ink-faint)',
        total: row.total,
      };
    });

    // Budget performance for the reviewed month (spent recomputed from transactions).
    const monthTransactions = await Transaction.find({
      user: userId,
      type: 'expense',
      date: { $gte: monthStart, $lt: monthEnd },
    });
    const spentByCategory = new Map();
    let totalMonthExpense = 0;
    for (const txn of monthTransactions) {
      totalMonthExpense += txn.amount;
      const key = txn.category ? String(txn.category) : 'uncategorized';
      spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + txn.amount);
    }
    const budgetPerformance = budgets.map((b) => {
      const spent = b.category
        ? spentByCategory.get(String(b.category._id || b.category)) ?? 0
        : totalMonthExpense;
      return {
        name: b.category && typeof b.category === 'object' ? b.category.name : 'Overall',
        amount: b.amount || 0,
        spent,
        pct: b.amount ? (spent / b.amount) * 100 : 0,
        over: spent > (b.amount || 0),
      };
    });

    res.json({
      month: monthKey,
      monthLabel: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
        new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)
      ),
      productivity,
      habits,
      finance,
      goals,
      focus,
      topCategories: topCategoriesResolved,
      budgetPerformance,
      netWorth,
      summary: {
        tasksCompleted: productivity.completed,
        tasksCreated: productivity.created,
        taskCompletionRate: productivity.completionRate,
        topSpendingCategory: topCategoriesResolved[0]?.name ?? null,
        netCashFlow: finance.saved,
        netWorthTotal: netWorth.total,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/monthly-review/ai-summary
 * Body: { month?: "YYYY-MM" } — default: current month.
 *
 * The AI receives ONLY backend-calculated figures and answers four questions:
 * what went well, what needs attention, the biggest change, next month's
 * priorities. It never computes its own balances.
 */
const aiSummary = async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: 'AI service is not configured' });
    }
    const userId = req.user._id;
    const now = new Date();
    const monthKey = String(req.body?.month || monthKeyOf(now));

    // Reuse the deterministic computation, then serialize only safe numbers.
    const reqStub = { user: req.user, query: { month: monthKey } };
    let data;
    let lastError;
    await getMonthlyReview(reqStub, { json: (v) => (data = v) }, (err) => (lastError = err));
    if (lastError || !data) throw lastError || new Error('Could not compute monthly review');

    const lang = await getUserLanguage(userId);
    const fmt = (n) =>
      new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(n) || 0);

    const budgetLines = data.budgetPerformance.length
      ? data.budgetPerformance
          .map(
            (b) =>
              `- ${b.name}: budget ${fmt(b.amount)}, spent ${fmt(b.spent)}` +
              (b.over ? ' (OVER)' : ` (${Math.round(b.pct)}% used)`)
          )
          .join('\n')
      : '- none set';

    const categoryLines = data.topCategories.length
      ? data.topCategories.map((c) => `- ${c.name}: ${fmt(c.total)}`).join('\n')
      : '- none';

    const prompt = `Here is the user's LifeHub data for ${data.monthLabel} (all figures were calculated by the system from the user's records — restate them exactly, never compute your own):\n\nPRODUCTIVITY\n- Tasks completed: ${data.productivity.completed}\n- Tasks created: ${data.productivity.created}\n- Task completion rate: ${data.productivity.completionRate}%\n- Overdue tasks now: ${data.productivity.overdue}\n\nFOCUS TIME\n- Focus sessions: ${data.focus.count}\n- Total focus time: ${Math.round(data.focus.duration / 60)} minutes\n\nFINANCE\n- Income: ${fmt(data.finance.income)} (previous month: ${fmt(data.finance.previous.income)})\n- Expense: ${fmt(data.finance.expense)} (previous month: ${fmt(data.finance.previous.expense)})\n- Net cash flow: ${fmt(data.finance.saved)}\n- Total balance across accounts: ${fmt(data.netWorth.total)}\n- Liquid assets (cash + bank + e-wallet): ${fmt(data.netWorth.liquid)}\n- Investment assets: ${fmt(data.netWorth.investment)}\n- Top spending categories:\n${categoryLines}\n- Budgets:\n${budgetLines}\n\nHABITS\n- Habits tracked: ${data.habits.tracked}\n- Average completion: ${data.habits.averageCompletion}%\n- Best streak: ${data.habits.bestStreak} day(s)\n\nGOALS\n- Goals progressed this month: ${data.goals.progressed}\n- Goals completed this month: ${data.goals.completed}\n\nWrite a concise Markdown monthly review with exactly four sections:\n1. **What went well**\n2. **What needs attention**\n3. **Biggest change**\n4. **Next month's priorities**\n\nBase everything strictly on the data above. If a section has no data (e.g. no habits tracked), say so instead of inventing numbers. Never present this as professional financial advice. Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}.`;

    const reply = await generate(prompt);
    res.json({ success: true, month: monthKey, reply });
  } catch (err) {
    if (err?.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ success: false, message: 'AI service is not configured' });
    }
    console.error('[monthly-review] ai-summary failed:', err?.message);
    res.status(502).json({ success: false, message: 'AI service is temporarily unavailable.' });
  }
};

module.exports = { getMonthlyReview, aiSummary };
