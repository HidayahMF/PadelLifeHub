const Account = require('../models/Account');
const AccountBalanceAdjustment = require('../models/AccountBalanceAdjustment');

function invalidateCache(userId) {
  try {
    const { invalidateUserCache } = require('../services/aiContext')._cacheUtils;
    if (invalidateUserCache) invalidateUserCache(userId);
  } catch {
    // Non-fatal — cache module may not be loaded yet in test stubs.
  }
}

/**
 * Fields a client is allowed to set on a NEW account. `balance` stays allowed
 * here as the opening-balance semantic only — subsequent balance changes MUST
 * go through the adjustment endpoint so every change has history.
 */
const CREATEABLE_FIELDS = ['name', 'type', 'balance', 'currency'];

/** Fields editable on an EXISTING account — metadata only, never balance. */
const UPDATABLE_FIELDS = ['name', 'type'];

function pick(obj, keys) {
  const out = {};
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

const getAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ user: req.user._id }).sort({
      createdAt: 1,
    });
    res.json(accounts);
  } catch (err) {
    next(err);
  }
};

const createAccount = async (req, res, next) => {
  try {
    const account = await Account.create({
      user: req.user._id,
      ...pick(req.body, CREATEABLE_FIELDS),
    });
    invalidateCache(req.user._id);
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }

    // Metadata only — `balance` and `user` can never be overwritten through
    // this endpoint. Balance changes go through POST /:id/adjustments.
    Object.assign(account, pick(req.body, UPDATABLE_FIELDS));
    const updated = await account.save();
    invalidateCache(req.user._id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }

    invalidateCache(req.user._id);
    res.json({ message: 'Account removed' });
  } catch (err) {
    next(err);
  }
};

/**
 * Validate a balance-adjustment payload. Returns { newBalance, reason } or
 * throws a 400 with a user-meaningful message.
 */
function parseAdjustmentInput(body = {}, { currency }) {
  const newBalance = Number(body.newBalance);
  if (!Number.isFinite(newBalance)) {
    const err = new Error('New balance must be a valid number');
    err.statusCode = 400;
    throw err;
  }
  if (newBalance < 0) {
    const err = new Error('New balance cannot be negative');
    err.statusCode = 400;
    throw err;
  }
  const reason = String(body.reason ?? '').trim();
  if (!reason) {
    const err = new Error('Reason is required');
    err.statusCode = 400;
    throw err;
  }
  return { newBalance, reason, currency: currency || 'IDR' };
}

/**
 * POST /api/accounts/:id/adjustments
 *
 * Sets the account balance to `newBalance` and appends an immutable history
 * record. Concurrency-safe: the balance is written with a conditional update
 * matching the freshly-read `previousBalance`, so a transaction that landed in
 * the meantime is never silently overwritten — the request fails with 409 and
 * the client can retry against the latest balance.
 */
const adjustBalance = async (req, res, next) => {
  try {
    // Fresh read from the database — never trust a client-supplied old balance.
    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }

    const { newBalance, reason, currency } = parseAdjustmentInput(req.body, account);
    const previousBalance = Number(account.balance) || 0;

    if (newBalance === previousBalance) {
      res.status(400);
      throw new Error('Balance is already the requested value');
    }

    const difference = newBalance - previousBalance;

    // 1) Append the immutable history row FIRST so a balance change never
    //    exists without a matching record.
    const adjustment = await AccountBalanceAdjustment.create({
      user: req.user._id,
      account: account._id,
      previousBalance,
      newBalance,
      difference,
      reason,
      currency,
    });

    // 2) Conditional write — only apply if balance still equals the value we
    //    based the adjustment on. A concurrent income/expense/transfer that
    //    changed the balance in between makes this match nothing.
    const result = await Account.updateOne(
      { _id: account._id, user: req.user._id, balance: previousBalance },
      { $set: { balance: newBalance } }
    );

    if (result.matchedCount !== 1) {
      // Roll back the history row so "balance unchanged" stays truthful.
      await AccountBalanceAdjustment.deleteOne({ _id: adjustment._id }).catch(() => {});
      res.status(409);
      throw new Error('Balance changed concurrently, please review and retry');
    }

    invalidateCache(req.user._id);

    const updatedAccount = await Account.findById(account._id);
    res.status(201).json({ account: updatedAccount, adjustment });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/accounts/:id/adjustments
 *
 * Newest-first history for the current user's account. Optional pagination via
 * `page` (1-based) and `limit` (default 20, max 100).
 */
const getAdjustments = async (req, res, next) => {
  try {
    const accountId = req.params.id;
    const user = req.user._id;

    // Ownership guard — 404 so other users cannot probe which accounts exist.
    const account = await Account.exists({ _id: accountId, user });
    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }

    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20)
    );
    const skip = (page - 1) * limit;

    const [adjustments, total] = await Promise.all([
      AccountBalanceAdjustment.find({ user, account: accountId })
        .sort({ adjustmentDate: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AccountBalanceAdjustment.countDocuments({ user, account: accountId }),
    ]);

    res.json({
      adjustments,
      total,
      page,
      limit,
      hasMore: skip + adjustments.length < total,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  adjustBalance,
  getAdjustments,
};