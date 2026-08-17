// Single source of truth for creating transactions and mutating account
// balances. Used by BOTH the manual Finance API (POST /api/transactions) and
// the AI quick-add flow (POST /api/ai/create-transaction), so the two paths
// can never drift apart.
//
// Every query here is scoped to the passed `userId` (which always comes from
// the authenticated JWT, never from the client).

const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Category = require('../models/Category');
const { nextOccurrence } = require('./recurringScheduler');

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

/**
 * Create an income / expense / transfer transaction for a user and apply the
 * matching account balance change. Shared by the manual Finance API and the
 * AI quick-add flow so balance math stays identical everywhere.
 *
 * @param {string} userId  - ObjectId string of the authenticated user
 * @param {object} body    - same shape as the manual POST /transactions body
 * @returns {Promise<object>} the created transaction document
 */
async function createTransactionForUser(userId, body) {
  const cleanBody = sanitizeTransactionBody(body);
  const { account, category, fromAccount, toAccount, type, recurring, date } = cleanBody;
  const normalizedDate = normalizeTransactionDate(date);
  const numericAmount = assertPositiveAmount(body.amount);

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
  await validateOwnership(userId, { account, category, fromAccount, toAccount });

  if (type === 'transfer') {
    const [from, to] = await Promise.all([
      Account.findOne({ _id: fromAccount, user: userId }),
      Account.findOne({ _id: toAccount, user: userId }),
    ]);
    from.balance -= numericAmount;
    to.balance += numericAmount;
    await Promise.all([from.save(), to.save()]);

    return Transaction.create({
      user: userId,
      type: 'transfer',
      amount: numericAmount,
      description: body.description || '',
      fromAccount,
      toAccount,
      date: normalizedDate,
    });
  }

  const nextRunAt = computeNextRunAt(normalizedDate, recurring);

  const transaction = await Transaction.create({
    user: userId,
    ...cleanBody,
    amount: numericAmount,
    date: normalizedDate,
    nextRunAt,
    lastRunAt: null,
    parentRecurringId: null,
  });

  await adjustAccountBalance(transaction, 1);

  // Invalidate any cached AI context for this user so the next AI call
  // sees the freshly created transaction.
  try {
    const { invalidateUserCache } = require('./aiContext')._cacheUtils;
    if (invalidateUserCache) invalidateUserCache(userId);
  } catch {
    // Non-fatal — cache module may not be loaded yet in test stubs.
  }

  return transaction;
}

module.exports = {
  createTransactionForUser,
  normalizeTransactionDate,
  sanitizeTransactionBody,
  assertPositiveAmount,
  validateOwnership,
  applyTransfer,
  adjustAccountBalance,
  computeNextRunAt,
};
