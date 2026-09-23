const Investment = require('../models/Investment');
const InvestmentTransaction = require('../models/InvestmentTransaction');
const Account = require('../models/Account');
const {
  summarize,
  valueChangeIn,
  classifyValueChange,
} = require('../services/investmentService');

function invalidateCache(userId) {
  try {
    const { invalidateUserCache } = require('../services/aiContext')._cacheUtils;
    if (invalidateUserCache) invalidateUserCache(userId);
  } catch {
    // Non-fatal — cache module may not be loaded yet in test stubs.
  }
}

/**
 * Synchronize the portfolio's current value to an Account of type 'investment'
 * that matches the portfolio's name (case-insensitive).
 */
async function syncInvestmentToAccount(userId, investmentId) {
  try {
    const investment = await Investment.findOne({ _id: investmentId, user: userId }).lean();
    if (!investment) return;

    const records = await InvestmentTransaction.find({ user: userId, investment: investmentId }).lean();
    const stats = summarize(records);

    const escapedName = investment.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const account = await Account.findOne({
      user: userId,
      type: 'investment',
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    });

    if (account) {
      account.balance = stats.currentValue;
      await account.save();
    }
  } catch {
    // Non-fatal sync
  }
}

/** Normalize a date payload into a local WIB date (calendar-date safe). */
function normalizeTransactionDate(value) {
  if (!value) return new Date();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

function assertPositiveAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error('Amount must be greater than zero');
    err.statusCode = 400;
    throw err;
  }
  return n;
}

function assertType(type) {
  if (!['deposit', 'withdrawal', 'gain', 'loss'].includes(type)) {
    const err = new Error('Invalid investment transaction type');
    err.statusCode = 400;
    throw err;
  }
  return type;
}

function assertCurrentValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(n)) {
    const err = new Error('Current value must be a valid non-negative whole number');
    err.statusCode = 400;
    throw err;
  }
  return n;
}

function assertDate(value) {
  const date = normalizeTransactionDate(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error('Invalid date');
    err.statusCode = 400;
    throw err;
  }
  return date;
}

async function loadTransactionsFor(userId, investmentId) {
  return InvestmentTransaction.find({
    user: userId,
    investment: investmentId,
  }).sort({ transaction_date: 1, createdAt: 1 });
}

/** Build value-per-day history from records (ascending date). */
function buildDailyHistory(records) {
  const byDay = new Map();
  const sorted = [...records].sort(
    (a, b) => new Date(a.transaction_date) - new Date(b.transaction_date)
  );
  let current = 0;
  for (const r of sorted) {
    const amount = Number(r.amount) || 0;
    if (r.type === 'deposit') current += amount;
    else if (r.type === 'withdrawal') current -= amount;
    else if (r.type === 'gain') current += amount;
    else if (r.type === 'loss') current -= amount;
    const d = new Date(r.transaction_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    byDay.set(key, current);
  }
  return [...byDay.entries()].map(([date, value]) => ({ date, value }));
}

// ── Portfolio CRUD ──────────────────────────────────────────────────────────

const getPortfolios = async (req, res, next) => {
  try {
    const [portfolios, allTransactions] = await Promise.all([
      Investment.find({ user: req.user._id }).sort({ createdAt: 1 }).lean(),
      InvestmentTransaction.find({ user: req.user._id })
        .sort({ transaction_date: 1, createdAt: 1 })
        .lean(),
    ]);

    const recordsByPortfolio = new Map();
    for (const tx of allTransactions) {
      const key = String(tx.investment);
      if (!recordsByPortfolio.has(key)) recordsByPortfolio.set(key, []);
      recordsByPortfolio.get(key).push(tx);
    }

    const enriched = portfolios.map((p) => {
      const records = recordsByPortfolio.get(String(p._id)) || [];
      const stats = summarize(records);
      return { ...p, ...stats };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

const createPortfolio = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      const err = new Error('Portfolio name is required');
      err.statusCode = 400;
      throw err;
    }
    const portfolio = await Investment.create({
      user: req.user._id,
      name,
      description: String(req.body.description || '').trim(),
    });
    invalidateCache(req.user._id);
    res.status(201).json(portfolio);
  } catch (err) {
    next(err);
  }
};

const updatePortfolio = async (req, res, next) => {
  try {
    const portfolio = await Investment.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!portfolio) {
      res.status(404);
      throw new Error('Portfolio not found');
    }
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        const err = new Error('Portfolio name is required');
        err.statusCode = 400;
        throw err;
      }
      portfolio.name = name;
    }
    if (req.body.description !== undefined) {
      portfolio.description = String(req.body.description).trim();
    }
    const updated = await portfolio.save();
    await syncInvestmentToAccount(req.user._id, updated._id);
    invalidateCache(req.user._id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deletePortfolio = async (req, res, next) => {
  try {
    const portfolio = await Investment.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!portfolio) {
      res.status(404);
      throw new Error('Portfolio not found');
    }
    await InvestmentTransaction.deleteMany({ investment: portfolio._id });
    invalidateCache(req.user._id);
    res.json({ message: 'Portfolio removed' });
  } catch (err) {
    next(err);
  }
};

// ── Portfolio stats + history ───────────────────────────────────────────────

const getPortfolioDetail = async (req, res, next) => {
  try {
    const [portfolio, records] = await Promise.all([
      Investment.findOne({
        _id: req.params.id,
        user: req.user._id,
      }).lean(),
      InvestmentTransaction.find({
        user: req.user._id,
        investment: req.params.id,
      })
        .sort({ transaction_date: -1, createdAt: -1 })
        .lean(),
    ]);

    if (!portfolio) {
      res.status(404);
      throw new Error('Portfolio not found');
    }

    const stats = summarize(records);

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    res.json({
      ...portfolio,
      ...stats,
      todayChange: valueChangeIn(records, dayStart, nextDay),
      monthChange: valueChangeIn(records, monthStart, nextMonth),
      history: buildDailyHistory(records),
      transactions: records,
    });
  } catch (err) {
    next(err);
  }
};

// ── Transaction CRUD ────────────────────────────────────────────────────────

const getTransactions = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.investment) filter.investment = req.query.investment;
    const transactions = await InvestmentTransaction.find(filter)
      .sort({
        transaction_date: -1,
        createdAt: -1,
      })
      .lean();
    res.json(transactions);
  } catch (err) {
    next(err);
  }
};

// Update a broker-reported portfolio value without treating capital movements
// as profit/loss. The lease prevents two workers from calculating from the same
// derived value; the unique request id makes retries safe.
const syncValue = async (req, res, next) => {
  const userId = req.user._id;
  const investmentId = req.params.id;
  const requestId = String(req.get('Idempotency-Key') || req.body.idempotencyKey || '').trim();
  try {
    if (!requestId || requestId.length > 120) {
      const err = new Error('Idempotency key is required');
      err.statusCode = 400;
      throw err;
    }
    const existing = await InvestmentTransaction.findOne({
      user: userId,
      investment: investmentId,
      syncRequestId: requestId,
    }).lean();
    const portfolioForRetry = await Investment.findOne({ _id: investmentId, user: userId }).lean();
    if (portfolioForRetry?.lastSyncRequestId === requestId) {
      const currentValue = summarize(await loadTransactionsFor(userId, investmentId)).currentValue;
      return res.json({ previousValue: currentValue, currentValue, difference: 0, changeType: 'none', transaction: null });
    }
    if (existing) {
      const records = await loadTransactionsFor(userId, investmentId);
      const stats = summarize(records);
      return res.json({
        previousValue: stats.currentValue - (existing.type === 'gain' ? existing.amount : existing.type === 'loss' ? -existing.amount : 0),
        currentValue: stats.currentValue,
        difference: existing.type === 'gain' ? existing.amount : existing.type === 'loss' ? -existing.amount : 0,
        changeType: existing.type,
        transaction: existing,
      });
    }

    const value = assertCurrentValue(req.body.currentValue);
    const date = assertDate(req.body.date || req.body.transaction_date);
    const lockUntil = new Date(Date.now() + 15_000);
    const portfolio = await Investment.findOneAndUpdate(
      {
        _id: investmentId,
        user: userId,
        $or: [{ syncLockUntil: null }, { syncLockUntil: { $exists: false } }, { syncLockUntil: { $lte: new Date() } }],
      },
      { $set: { syncLockUntil: lockUntil } },
      { new: true }
    );
    if (!portfolio) {
      const err = new Error('Portfolio is being updated; please retry');
      err.statusCode = 409;
      throw err;
    }

    try {
      const records = await loadTransactionsFor(userId, investmentId);
      const previousValue = summarize(records).currentValue;
      const { difference, type: changeType, amount } = classifyValueChange(previousValue, value);
      let transaction = null;
      if (difference !== 0) {
        transaction = await InvestmentTransaction.create({
          user: userId,
          investment: investmentId,
          type: changeType,
          amount,
          transaction_date: date,
          note: String(req.body.note || '').trim(),
          syncRequestId: requestId,
        });
      }
      await Investment.updateOne({ _id: investmentId, user: userId }, { $set: { lastSyncRequestId: requestId } });
      await syncInvestmentToAccount(userId, investmentId);
      invalidateCache(userId);
      return res.status(transaction ? 201 : 200).json({
        previousValue,
        currentValue: value,
        difference,
        changeType,
        transaction,
        portfolio: { ...portfolio.toObject(), currentValue: value },
      });
    } catch (err) {
      if (err?.code === 11000) {
        const duplicate = await InvestmentTransaction.findOne({ user: userId, investment: investmentId, syncRequestId: requestId }).lean();
        if (duplicate) return res.json({ transaction: duplicate, changeType: duplicate.type, difference: duplicate.type === 'gain' ? duplicate.amount : -duplicate.amount });
      }
      throw err;
    } finally {
      await Investment.updateOne({ _id: investmentId, user: userId }, { $set: { syncLockUntil: null } });
    }
  } catch (err) {
    next(err);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const investmentId = req.body.investment;
    if (!investmentId) {
      const err = new Error('Investment portfolio is required');
      err.statusCode = 400;
      throw err;
    }
    const investment = await Investment.findOne({ _id: investmentId, user: userId });
    if (!investment) {
      const err = new Error('Investment portfolio not found');
      err.statusCode = 400;
      throw err;
    }
    const type = assertType(req.body.type);
    const amount = assertPositiveAmount(req.body.amount);

    const txn = await InvestmentTransaction.create({
      user: userId,
      investment: investmentId,
      type,
      amount,
      transaction_date: normalizeTransactionDate(req.body.transaction_date || req.body.date),
      note: String(req.body.note || '').trim(),
    });
    await syncInvestmentToAccount(userId, investmentId);
    invalidateCache(userId);
    res.status(201).json(txn);
  } catch (err) {
    next(err);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const txn = await InvestmentTransaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!txn) {
      res.status(404);
      throw new Error('Transaction not found');
    }
    if (req.body.investment !== undefined) {
      const inv = await Investment.findOne({
        _id: req.body.investment,
        user: req.user._id,
      });
      if (!inv) {
        const err = new Error('Investment portfolio not found');
        err.statusCode = 400;
        throw err;
      }
      txn.investment = req.body.investment;
    }
    if (req.body.type !== undefined) txn.type = assertType(req.body.type);
    if (req.body.amount !== undefined) txn.amount = assertPositiveAmount(req.body.amount);
    if (req.body.transaction_date !== undefined || req.body.date !== undefined) {
      txn.transaction_date = normalizeTransactionDate(
        req.body.transaction_date ?? req.body.date
      );
    }
    if (req.body.note !== undefined) txn.note = String(req.body.note).trim();
    const updated = await txn.save();
    await syncInvestmentToAccount(req.user._id, txn.investment);
    invalidateCache(req.user._id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const txn = await InvestmentTransaction.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!txn) {
      res.status(404);
      throw new Error('Transaction not found');
    }
    await syncInvestmentToAccount(req.user._id, txn.investment);
    invalidateCache(req.user._id);
    res.json({ message: 'Transaction removed' });
  } catch (err) {
    next(err);
  }
};

// ── Aggregate overview for the whole user (dashboard widget) ───────────────

const getOverview = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [portfolios, allRecords] = await Promise.all([
      Investment.find({ user: userId }).lean(),
      InvestmentTransaction.find({ user: userId }).lean(),
    ]);
    const recordsByPortfolio = new Map();
    for (const txn of allRecords) {
      const key = String(txn.investment);
      if (!recordsByPortfolio.has(key)) recordsByPortfolio.set(key, []);
      recordsByPortfolio.get(key).push(txn);
    }

    let currentValue = 0;
    let totalInvested = 0;
    let profitLoss = 0;
    let netCapital = 0;
    let deposits = 0;
    let withdrawals = 0;
    const perPortfolio = [];
    for (const p of portfolios) {
      const records = recordsByPortfolio.get(String(p._id)) || [];
      const stats = summarize(records);
      currentValue += stats.currentValue;
      totalInvested += stats.totalDeposits;
      profitLoss += stats.profitLoss;
      netCapital += stats.netCapitalInvested;
      deposits += stats.totalDeposits;
      withdrawals += stats.totalWithdrawals;
      perPortfolio.push({ _id: p._id, name: p.name, description: p.description, ...stats });
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const returnPct = netCapital > 0 ? (profitLoss / netCapital) * 100 : 0;

    res.json({
      currentValue,
      totalInvested: deposits,
      netCapitalInvested: netCapital,
      profitLoss,
      returnPct: Math.round((returnPct + Number.EPSILON) * 100) / 100,
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      todayChange: valueChangeIn(allRecords, dayStart, nextDay),
      monthChange: valueChangeIn(allRecords, monthStart, nextMonth),
      portfolios: perPortfolio,
      count: portfolios.length,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPortfolios,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  getPortfolioDetail,
  getTransactions,
  syncValue,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getOverview,
};
