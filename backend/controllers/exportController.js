// Export — downloads of the user's OWN data only. Passwords, tokens, secrets
// and other users' data are never included.
//
// Three export formats, all scoped to the authenticated user (req.user._id):
//   - CSV        (raw / compatibility)   GET /export/transactions, /tasks
//   - JSON       (backup / machine)      GET /export/all
//   - Excel      (human-readable)        GET /export/transactions/excel,
//                                         /export/tasks/excel, /export/all/excel

const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Goal = require('../models/Goal');
const Habit = require('../models/Habit');
const Need = require('../models/Need');
const Note = require('../models/Note');
const Reminder = require('../models/Reminder');
const Wishlist = require('../models/Wishlist');
const {
  buildTransactionsWorkbook,
  buildTasksWorkbook,
  buildFullWorkbook,
} = require('../services/excelExportService');
const { formatLocalDate } = require('../utils/date');
const { getMonthlyReview } = require('./monthlyReviewController');

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function escapeCsv(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[\",\n]/.test(s) ? `\"${s.replace(/\"/g, '\"\"')}\"` : s;
}

function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}

// ---------------------------------------------------------------------------
// Shared data loaders (user-scoped by construction)
// ---------------------------------------------------------------------------

async function loadTransactions(userId) {
  return Transaction.find({ user: userId })
    .sort({ date: -1 })
    .populate('category', 'name')
    .populate('account', 'name')
    .populate('fromAccount', 'name')
    .populate('toAccount', 'name');
}

async function loadTasks(userId) {
  return Task.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate('category', 'name');
}

async function sendWorkbook(res, wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );
  res.send(Buffer.from(buffer));
}

// ---------------------------------------------------------------------------
// Transactions CSV (raw)
// ---------------------------------------------------------------------------

const exportTransactionsCsv = async (req, res, next) => {
  try {
    const transactions = await loadTransactions(req.user._id);

    const headers = ['date', 'type', 'amount', 'description', 'category', 'account', 'from', 'to'];
    const rows = transactions.map((t) => [
      t.date ? new Date(t.date).toISOString() : '',
      t.type,
      t.amount,
      t.description || '',
      t.category?.name ?? '',
      t.account?.name ?? '',
      t.fromAccount?.name ?? '',
      t.toAccount?.name ?? '',
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lifehub-transactions-${Date.now()}.csv"`
    );
    res.send(toCsv(rows, headers));
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Tasks CSV (raw)
// ---------------------------------------------------------------------------

const exportTasksCsv = async (req, res, next) => {
  try {
    const tasks = await loadTasks(req.user._id);

    const headers = ['title', 'status', 'priority', 'dueDate', 'category', 'tags', 'pinned', 'completedAt', 'createdAt'];
    const rows = tasks.map((t) => [
      t.title,
      t.status,
      t.priority || 'medium',
      t.dueDate ? new Date(t.dueDate).toISOString() : '',
      t.category?.name ?? '',
      (t.tags || []).join('|'),
      t.pinned ? 'yes' : 'no',
      t.completedAt ? new Date(t.completedAt).toISOString() : '',
      new Date(t.createdAt).toISOString(),
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lifehub-tasks-${Date.now()}.csv"`);
    res.send(toCsv(rows, headers));
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Transactions Excel (styled, human-readable)
// ---------------------------------------------------------------------------

const exportTransactionsExcel = async (req, res, next) => {
  try {
    const transactions = await loadTransactions(req.user._id);
    const wb = await buildTransactionsWorkbook({ transactions });
    await sendWorkbook(res, wb, `LifeHub-Transactions-${formatLocalDate()}.xlsx`);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Tasks Excel (styled, human-readable)
// ---------------------------------------------------------------------------

const exportTasksExcel = async (req, res, next) => {
  try {
    const tasks = await loadTasks(req.user._id);
    const wb = await buildTasksWorkbook({ tasks });
    await sendWorkbook(res, wb, `LifeHub-Tasks-${formatLocalDate()}.xlsx`);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Full LifeHub Excel workbook
// ---------------------------------------------------------------------------

/** Aggregate all-time income / expense for the Dashboard sheet. */
async function incomeExpenseTotals(userId) {
  const [income, expense] = await Promise.all([
    Transaction.aggregate([
      { $match: { user: userId, type: 'income' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { user: userId, type: 'expense' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  return {
    totalIncome: income[0]?.total || 0,
    totalExpense: expense[0]?.total || 0,
  };
}

/** Aggregate account balances by type (same math as the Dashboard). */
async function accountTypeTotals(userId) {
  const rows = await Account.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$type', total: { $sum: '$balance' } } },
  ]);
  const typeTotals = { bank: 0, ewallet: 0, cash: 0, investment: 0 };
  for (const row of rows) {
    if (row._id in typeTotals) typeTotals[row._id] = row.total;
  }
  return typeTotals;
}

/** Top expense categories (all time) for the Spending by Category chart. */
async function categorySpending(userId, categories) {
  const rows = await Transaction.aggregate([
    { $match: { user: userId, type: 'expense' } },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } },
    { $limit: 5 },
  ]);
  const catMap = new Map((categories || []).map((c) => [String(c._id), c.name]));
  return rows.map((row) => ({
    name: row._id ? catMap.get(String(row._id)) || 'Uncategorized' : 'Uncategorized',
    total: row.total,
  }));
}

const exportAllExcel = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [tasks, transactions, accounts, goals, habits, needs, notes, reminders, wishlist, categories] =
      await Promise.all([
        loadTasks(userId),
        loadTransactions(userId),
        Account.find({ user: userId }).sort({ createdAt: 1 }),
        Goal.find({ user: userId }).sort({ createdAt: 1 }),
        Habit.find({ user: userId }).sort({ createdAt: 1 }),
        Need.find({ user: userId }).sort({ createdAt: 1 }),
        Note.find({ user: userId }).sort({ createdAt: 1 }),
        Reminder.find({ user: userId }).sort({ createdAt: 1 }),
        Wishlist.find({ user: userId }).sort({ createdAt: 1 }),
        Category.find({ user: userId }),
      ]);

    const [{ totalIncome, totalExpense }, typeTotals] = await Promise.all([
      incomeExpenseTotals(userId),
      accountTypeTotals(userId),
    ]);

    const [totalTasks, completedTasks, activeGoals, bestHabitStreak, spending] = await Promise.all([
      Task.countDocuments({ user: userId, archived: { $ne: true } }),
      Task.countDocuments({ user: userId, status: 'completed' }),
      Goal.countDocuments({ user: userId, completed: { $ne: true }, archived: { $ne: true } }),
      Habit.find({ user: userId, archived: { $ne: true } }).then((habits) =>
        habits.reduce((max, h) => Math.max(max, Number(h.bestStreak) || 0), 0)
      ),
      categorySpending(userId, categories),
    ]);

    const netWorth = Object.values(typeTotals).reduce((s, v) => s + v, 0);
    const liquidAssets = typeTotals.bank + typeTotals.ewallet + typeTotals.cash;

    const dashboard = {
      netWorth,
      liquidAssets,
      investmentAssets: typeTotals.investment,
      totalIncome,
      totalExpense,
      netCashFlow: totalIncome - totalExpense,
      accountCount: accounts.length,
      transactionCount: transactions.length,
      totalTasks,
      completedTasks,
      taskCompletionPct: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
      activeGoals,
      bestHabitStreak,
      accounts: accounts.map((a) => ({ name: a.name, type: a.type, balance: a.balance })),
      categorySpending: spending,
    };

    // Monthly Review sheet — reuse the authoritative monthly-review computation
    // (same figures the app shows) when the user has any data this month.
    let monthlyReview = null;
    try {
      const reqStub = { user: req.user, query: {} };
      let data;
      await getMonthlyReview(reqStub, { json: (v) => (data = v) }, () => {});
      const hasData =
        (data.finance?.income || 0) > 0 ||
        (data.finance?.expense || 0) > 0 ||
        (data.productivity?.completed || 0) > 0 ||
        (data.habits?.tracked || 0) > 0 ||
        (data.goals?.progressed || 0) > 0 ||
        (data.focus?.count || 0) > 0;
      if (hasData) monthlyReview = data;
    } catch {
      // Non-fatal — the workbook still exports without the Monthly Review sheet.
    }

    const wb = await buildFullWorkbook({
      dashboard,
      accounts,
      transactions,
      tasks,
      goals,
      habits,
      wishlist,
      needs,
      notes,
      reminders,
      monthlyReview,
    });
    await sendWorkbook(res, wb, `LifeHub-Export-${formatLocalDate()}.xlsx`);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Full LifeHub JSON (backup / machine-readable)
// ---------------------------------------------------------------------------

const exportAllJson = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [
      tasks,
      transactions,
      accounts,
      budgets,
      categories,
      goals,
      habits,
      needs,
      notes,
      reminders,
      wishlist,
    ] = await Promise.all([
      Task.find({ user: userId }),
      Transaction.find({ user: userId }),
      Account.find({ user: userId }),
      Budget.find({ user: userId }),
      Category.find({ user: userId }),
      Goal.find({ user: userId }),
      Habit.find({ user: userId }),
      Need.find({ user: userId }),
      Note.find({ user: userId }),
      Reminder.find({ user: userId }),
      Wishlist.find({ user: userId }),
    ]);

    // Explicitly whitelist user fields — never the password, tokens or secrets.
    const user = {
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      createdAt: req.user.createdAt,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lifehub-data-${Date.now()}.json"`
    );
    res.send(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          app: 'LifeHub',
          user,
          tasks,
          transactions,
          accounts,
          budgets,
          categories,
          goals,
          habits,
          needs,
          notes,
          reminders,
          wishlist,
        },
        null,
        2
      )
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  exportTransactionsCsv,
  exportTasksCsv,
  exportTransactionsExcel,
  exportTasksExcel,
  exportAllExcel,
  exportAllJson,
};
