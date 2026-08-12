// Export — downloads of the user's OWN data only. Passwords, tokens, secrets
// and other users' data are never included.

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

function escapeCsv(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}

const exportTransactionsCsv = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ date: -1 })
      .populate('category', 'name')
      .populate('account', 'name')
      .populate('fromAccount', 'name')
      .populate('toAccount', 'name');

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

const exportTasksCsv = async (req, res, next) => {
  try {
    const tasks = await Task.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('category', 'name');

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

module.exports = { exportTransactionsCsv, exportTasksCsv, exportAllJson };
