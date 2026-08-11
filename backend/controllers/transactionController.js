const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Category = require('../models/Category');
const { nextOccurrence } = require('../services/recurringScheduler');

/** Normalize a date payload into a local Date (calendar-date safe for WIB). */
function normalizeTransactionDate(value) {
  if (!value) return new Date();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight (WIB), no UTC drift
  }
  return new Date(value);
}

/**
 * Reject references to accounts/categories that do not belong to the user,
 * so user A can never attach user B's account/category to a transaction.
 */
async function validateOwnership(userId, { account, category }) {
  if (account) {
    const acc = await Account.findOne({ _id: account, user: userId });
    if (!acc) {
      const err = new Error('Account not found');
      err.statusCode = 400;
      throw err;
    }
  }
  if (category) {
    const cat = await Category.findOne({ _id: category, user: userId });
    if (!cat) {
      const err = new Error('Category not found');
      err.statusCode = 400;
      throw err;
    }
  }
}

/**
 * Apply income/expense to the linked account balance (user-scoped lookup).
 * delta = +1 apply, -1 reverse.
 */
const adjustAccountBalance = async (transaction, delta = 1) => {
  if (!transaction.account) return;
  const account = await Account.findOne({ _id: transaction.account, user: transaction.user });
  if (!account) return;
  const change = transaction.type === 'income' ? transaction.amount : -transaction.amount;
  account.balance += change * delta;
  await account.save();
};

/** Compute nextRunAt for a recurring transaction based on its date/frequency. */
function computeNextRunAt(date, recurring) {
  if (!recurring || !recurring.isRecurring) return null;
  return nextOccurrence(date, recurring.frequency || 'monthly');
}

const getTransactions = async (req, res, next) => {
  try {
    const { type, account, category, startDate, endDate, search } = req.query;
    const filter = { user: req.user._id };

    if (type) filter.type = type;
    if (account) filter.account = account;
    if (category) filter.category = category;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = normalizeTransactionDate(startDate);
      if (endDate) filter.date.$lte = normalizeTransactionDate(endDate);
    }

    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }

    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .populate('category', 'name color icon')
      .populate('account', 'name type');

    res.json(transactions);
  } catch (err) {
    next(err);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate('category', 'name color icon')
      .populate('account', 'name type');

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    res.json(transaction);
  } catch (err) {
    next(err);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const { account, category, recurring, date } = req.body;
    await validateOwnership(req.user._id, { account, category });

    const normalizedDate = normalizeTransactionDate(date);
    const nextRunAt = computeNextRunAt(normalizedDate, recurring);

    const transaction = await Transaction.create({
      user: req.user._id,
      ...req.body,
      date: normalizedDate,
      nextRunAt,
      lastRunAt: null,
      parentRecurringId: null,
    });

    await adjustAccountBalance(transaction, 1);
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    const { account, category, recurring, date } = req.body;
    await validateOwnership(req.user._id, { account, category });

    // Reverse old effect on the previous account, then re-apply to the new one.
    await adjustAccountBalance(transaction, -1);
    Object.assign(transaction, req.body);
    if (date !== undefined) transaction.date = normalizeTransactionDate(date);
    if (recurring !== undefined) {
      transaction.recurring = { ...transaction.recurring, ...recurring };
    }
    // Keep the schedule in sync when date or recurrence changes.
    if (recurring !== undefined || date !== undefined) {
      transaction.nextRunAt = computeNextRunAt(transaction.date, transaction.recurring);
    }
    if (recurring !== undefined && (!recurring.isRecurring || !recurring.frequency)) {
      // Turning recurrence off clears the schedule.
      if (recurring.isRecurring === false) transaction.nextRunAt = null;
    }

    const updated = await transaction.save();
    await adjustAccountBalance(updated, 1);

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    await adjustAccountBalance(transaction, -1);
    await transaction.deleteOne();
    res.json({ message: 'Transaction removed' });
  } catch (err) {
    next(err);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { user: req.user._id };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = normalizeTransactionDate(startDate);
      if (endDate) filter.date.$lte = normalizeTransactionDate(endDate);
    }

    const [totalIncome, totalExpense] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...filter, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...filter, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const income = totalIncome[0]?.total || 0;
    const expense = totalExpense[0]?.total || 0;

    res.json({
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
};
