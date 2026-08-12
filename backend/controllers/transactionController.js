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
async function validateOwnership(userId, { account, category, fromAccount, toAccount }) {
  const accountIds = [account, fromAccount, toAccount].filter(Boolean);
  if (accountIds.length) {
    const found = await Account.countDocuments({ _id: { $in: accountIds }, user: userId });
    if (found !== accountIds.length) {
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

/** Require a positive, finite amount. */
function assertPositiveAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error('Amount must be greater than zero');
    err.statusCode = 400;
    throw err;
  }
  return n;
}

/**
 * Clean a transaction payload before it hits Mongoose.
 * - Empty-string reference fields ('' from HTML forms) would otherwise throw
 *   a CastError on ObjectId casting.
 * - Type-irrelevant fields are dropped so a transfer never carries an
 *   income/expense `account`, and vice versa.
 */
function sanitizeTransactionBody(body = {}) {
  const cleaned = { ...body };
  for (const key of ['account', 'category', 'fromAccount', 'toAccount']) {
    if (cleaned[key] === '' || cleaned[key] === undefined) delete cleaned[key];
  }
  if (cleaned.type === 'transfer') {
    delete cleaned.account;
    delete cleaned.category;
  } else {
    delete cleaned.fromAccount;
    delete cleaned.toAccount;
  }
  return cleaned;
}

/**
 * Apply a transfer between two accounts (delta = +1 apply, -1 reverse).
 * Transfers never touch income/expense totals — only balances move.
 */
const applyTransfer = async (transaction, delta = 1) => {
  if (!transaction.fromAccount || !transaction.toAccount) return;
  const [from, to] = await Promise.all([
    Account.findOne({ _id: transaction.fromAccount, user: transaction.user }),
    Account.findOne({ _id: transaction.toAccount, user: transaction.user }),
  ]);
  if (from) {
    from.balance -= transaction.amount * delta;
    await from.save();
  }
  if (to) {
    to.balance += transaction.amount * delta;
    await to.save();
  }
};

/**
 * Apply income/expense to the linked account balance (user-scoped lookup).
 * delta = +1 apply, -1 reverse.
 */
const adjustAccountBalance = async (transaction, delta = 1) => {
  if (!transaction.account || transaction.type === 'transfer') return;
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
      .populate('account', 'name type')
      .populate('fromAccount', 'name type')
      .populate('toAccount', 'name type');

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
      .populate('account', 'name type')
      .populate('fromAccount', 'name type')
      .populate('toAccount', 'name type');

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
    const cleanBody = sanitizeTransactionBody(req.body);
    const { account, category, fromAccount, toAccount, type, recurring, date } = cleanBody;
    const normalizedDate = normalizeTransactionDate(date);
    const numericAmount = assertPositiveAmount(req.body.amount);

    // Transfer: move money between two accounts, never into income/expense.
    // Validate distinct accounts BEFORE ownership lookup so the user gets the
    // right error message (duplicate ids would trip the count-based check).
    if (type === 'transfer') {
      if (!fromAccount || !toAccount || fromAccount === toAccount) {
        const err = new Error('Select two different accounts for a transfer');
        err.statusCode = 400;
        throw err;
      }
    }
    await validateOwnership(req.user._id, { account, category, fromAccount, toAccount });

    if (type === 'transfer') {
      const [from, to] = await Promise.all([
        Account.findOne({ _id: fromAccount, user: req.user._id }),
        Account.findOne({ _id: toAccount, user: req.user._id }),
      ]);
      from.balance -= numericAmount;
      to.balance += numericAmount;
      await Promise.all([from.save(), to.save()]);

      const transaction = await Transaction.create({
        user: req.user._id,
        type: 'transfer',
        amount: numericAmount,
        description: req.body.description || '',
        fromAccount,
        toAccount,
        date: normalizedDate,
      });
      return res.status(201).json(transaction);
    }

    const nextRunAt = computeNextRunAt(normalizedDate, recurring);

    const transaction = await Transaction.create({
      user: req.user._id,
      ...cleanBody,
      amount: numericAmount,
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

    const cleanBody = sanitizeTransactionBody(req.body);
    const { account, category, fromAccount, toAccount, recurring, date, type } = cleanBody;

    const newType = type ?? transaction.type;
    const newAmount = req.body.amount !== undefined ? assertPositiveAmount(req.body.amount) : transaction.amount;

    // Validate the new transfer config BEFORE ownership lookup / balance changes.
    if (newType === 'transfer') {
      const from = fromAccount ?? transaction.fromAccount;
      const to = toAccount ?? transaction.toAccount;
      if (!from || !to || from === to) {
        const err = new Error('Select two different accounts for a transfer');
        err.statusCode = 400;
        throw err;
      }
    }
    await validateOwnership(req.user._id, { account, category, fromAccount, toAccount });

    // Reverse the old effect, then apply the new one.
    if (transaction.type === 'transfer') await applyTransfer(transaction, -1);
    else await adjustAccountBalance(transaction, -1);

    Object.assign(transaction, cleanBody);
    transaction.type = newType;
    transaction.amount = newAmount;
    if (date !== undefined) transaction.date = normalizeTransactionDate(date);
    if (recurring !== undefined) {
      transaction.recurring = { ...transaction.recurring, ...recurring };
    }
    if (recurring !== undefined || date !== undefined) {
      transaction.nextRunAt = computeNextRunAt(transaction.date, transaction.recurring);
    }
    if (recurring !== undefined && recurring.isRecurring === false) transaction.nextRunAt = null;

    if (transaction.type === 'transfer') await applyTransfer(transaction, 1);
    else await adjustAccountBalance(transaction, 1);

    const updated = await transaction.save();
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

    if (transaction.type === 'transfer') await applyTransfer(transaction, -1);
    else await adjustAccountBalance(transaction, -1);
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
