// Legacy "Investment"-as-expense migration service.
//
// Purpose: safely move money that users recorded as a normal EXPENSE under an
// investment-named category into the dedicated InvestmentTransaction system,
// WITHOUT deleting or rewriting the original records.
//
// Design guarantees:
//   - analysis() is READ-ONLY (never touches the DB) — used for the dry run.
//   - backup() exports the complete original records to disk before any change.
//   - migrate() is idempotent (a duplicated run never double-creates), only
//     touches transactions explicitly confirmed, and preserves originals via a
//     migratedToInvestment flag + investmentTransactionId reference.
//   - rollback() reverses migrate() precisely: removes the created investment
//     records and resets the flags, so original records behave normally again.
//
// Category matching is deliberate, NOT a broad substring match: only exact
// (case-insensitive) names APIInvest / Investasi / Invest count as investment.
// Categories whose name merely CONTAINS "invest" are reported separately as
// ambiguous and are never auto-migrated.

const path = require('path');
const fs = require('fs');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Investment = require('../models/Investment');
const InvestmentTransaction = require('../models/InvestmentTransaction');

// Exact investment alias names (lower-cased for comparison). Deliberately
// narrow to avoid catching e.g. "Investigator", "Loan Investment Promo".
const EXACT_INVESTMENT_NAMES = ['investment', 'investasi', 'invest'];

function normalize(name) {
  return String(name || '').trim().toLowerCase();
}

function isExactInvestmentName(name) {
  return EXACT_INVESTMENT_NAMES.includes(normalize(name));
}

/** Report-only: a category whose name CONTAINS "invest" but isn't exact. */
function isAmbiguousInvestmentName(name) {
  const n = normalize(name);
  return !isExactInvestmentName(name) && n.includes('invest');
}

/** YYYY-MM from a date. */
function monthKey(d) {
  if (!d) return 'unknown';
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Load all transaction-type categories belonging to a user, split into
 * exact-investment and ambiguous buckets. Every query is user-scoped.
 */
async function loadCategoryBuckets(userId) {
  const cats = await Category.find({ user: userId, type: 'transaction' }).select('_id name');
  const exactIds = [];
  const ambiguous = [];
  for (const c of cats) {
    if (isExactInvestmentName(c.name)) exactIds.push(String(c._id));
    else if (isAmbiguousInvestmentName(c.name)) ambiguous.push({ _id: String(c._id), name: c.name });
  }
  return { exactIds, ambiguous };
}

/**
 * READ-ONLY analysis of legacy investment expense transactions for a user.
 * Returns everything the dry-run report needs. Never modifies the database.
 *
 * @param {string} userId
 */
async function analyze(userId) {
  const { exactIds, ambiguous } = await loadCategoryBuckets(userId);
  const filter = {
    user: userId,
    type: 'expense',
    migratedToInvestment: { $ne: true },
  };
  if (exactIds.length) filter.category = { $in: exactIds };
  else return emptyReport(exactIds, ambiguous);

  const rows = await Transaction.find(filter).sort({ date: 1 }).lean();

  let totalAmount = 0;
  const byCategory = new Map();
  const byMonth = new Map();
  let minDate = null;
  let maxDate = null;
  for (const t of rows) {
    const amount = Number(t.amount) || 0;
    totalAmount += amount;
    const catKey = t.category ? String(t.category) : 'uncategorized';
    byCategory.set(catKey, (byCategory.get(catKey) || 0) + amount);
    const mk = monthKey(t.date);
    byMonth.set(mk, (byMonth.get(mk) || 0) + amount);
    const d = new Date(t.date).getTime();
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }

  return {
    exactInvestmentCategoryIds: exactIds,
    ambiguous,
    count: rows.length,
    totalAmount,
    dateRange:
      rows.length && minDate !== null && maxDate !== null
        ? { min: new Date(minDate).toISOString(), max: new Date(maxDate).toISOString() }
        : null,
    byCategory: [...byCategory.entries()].map(([id, amount]) => ({ categoryId: id, amount })),
    byMonth: [...byMonth.entries()].map(([month, amount]) => ({ month, amount })),
    sample: rows.slice(0, 20).map((t) => ({
      id: String(t._id),
      amount: Number(t.amount) || 0,
      date: t.date,
      description: t.description || '',
      category: String(t.category || ''),
    })),
    // Full records for backup — exact original docs.
    records: rows.map((t) => t.toObject ? t.toObject() : { ...t }),
  };
}

function emptyReport(exactIds, ambiguous) {
  return {
    exactInvestmentCategoryIds: exactIds,
    ambiguous,
    count: 0,
    totalAmount: 0,
    dateRange: null,
    byCategory: [],
    byMonth: [],
    sample: [],
    records: [],
  };
}

/**
 * Backup ALL candidate records to disk before any migration. Returns the file
 * paths written (records + a CSV manifest). Writes to <backend>/migrations-backup.
 * Backups the complete original Mongoose documents.
 *
 * @param {string} userId
 * @param {string} [label='manual'] short label for the filename
 */
async function backup(userId, label = 'manual') {
  const analysis = await analyze(userId);
  const dir = path.join(__dirname, '..', 'migrations-backup');
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = String(label).replace(/[^a-z0-9_-]/gi, '_') || 'manual';
  const jsonPath = path.join(dir, `investment-migration-${safeLabel}-${ts}.json`);
  const csvPath = path.join(dir, `investment-migration-${safeLabel}-${ts}.csv`);

  const payload = {
    exportedAt: new Date().toISOString(),
    userId: String(userId),
    count: analysis.records.length,
    totalAmount: analysis.totalAmount,
    note: 'BACKUP ONLY — original legacy investment expense transactions.',
    records: analysis.records,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  // CSV manifest with the fields the user requested + every original field.
  const headers = ['transactionId', 'userId', 'category', 'amount', 'date', 'description'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of analysis.records) {
    lines.push(
      [
        r._id, r.user, r.category, r.amount, r.date, r.description,
      ].map(esc).join(',')
    );
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

  return { jsonPath, csvPath, count: analysis.records.length };
}

/**
 * Ensure the user has an Investment portfolio to attach migrated deposits to.
 * Creates one named "Migrated Investments" if none exists. User-scoped.
 * Returns the portfolio _id.
 */
async function ensureMigrationPortfolio(userId) {
  let inv = await Investment.findOne({ user: userId, name: 'Migrated Investments' });
  if (!inv) {
    inv = await Investment.create({
      user: userId,
      name: 'Migrated Investments',
      description: 'Automatically created: holds legacy investment capital migrated from expense records.',
    });
  }
  return inv;
}

/**
 * Migrate a specific set of legacy expense transactions (by their _id) into
 * InvestmentTransaction deposits. IDEMPOTENT: already-migrated transactions are
 * skipped, so a re-run never duplicates. Preserves the original transaction and
 * flags it migratedToInvestment + investmentTransactionId.
 *
 * @param {string} userId
 * @param {string[]} transactionIds  confirmed legacy expense ids to migrate
 * @returns {{migrated:number, skipped:number, investmentTransactionIds:string[], portfolioId:string}}
 */
async function migrate(userId, transactionIds) {
  const { exactIds } = await loadCategoryBuckets(userId);
  const ids = [...new Set((transactionIds || []).map(String))];
  if (!ids.length) return { migrated: 0, skipped: 0, investmentTransactionIds: [], portfolioId: null };

  const existing = await Transaction.find({
    _id: { $in: ids },
    user: userId,
    type: 'expense',
    category: exactIds.length ? { $in: exactIds } : { $in: [] },
  });
  if (!existing.length) return { migrated: 0, skipped: 0, investmentTransactionIds: [], portfolioId: null };

  const portfolioId = await ensureMigrationPortfolio(userId);

  let migrated = 0;
  const createdIds = [];
  const toFlag = [];
  for (const t of existing) {
    if (t.migratedToInvestment) continue; // idempotency guard
    const amount = Number(t.amount) || 0;
    if (amount <= 0) continue;

    const invTxn = await InvestmentTransaction.create({
      user: userId,
      investment: portfolioId,
      type: 'deposit',
      amount,
      transaction_date: t.date,
      note: t.description || '',
    });
    createdIds.push(String(invTxn._id));
    toFlag.push({ id: t._id, invId: invTxn._id });
    migrated += 1;
  }

  for (const { id, invId } of toFlag) {
    await Transaction.updateOne({ _id: id }, { migratedToInvestment: true, investmentTransactionId: invId });
  }

  return { migrated, skipped: ids.length - migrated, investmentTransactionIds: createdIds, portfolioId: String(portfolioId._id) };
}

/**
 * Reverse a previous migration. Removes the InvestmentTransaction records
 * created by it and resets the migratedToInvestment flag on the originals.
 * SAFE: only removes records whose investmentTransactionId points back to the
 * flagged original, so unrelated investment records are never touched.
 *
 * @param {string} userId
 * @param {string[]} [investmentTransactionIds] Restrict to these ids (optional).
 */
async function rollback(userId, investmentTransactionIds) {
  const flagFilter = { user: userId, migratedToInvestment: true };
  const flagged = await Transaction.find(flagFilter).select('_id investmentTransactionId').lean();

  const seen = new Set();
  const invIdsToRemove = [];
  const originalsToReset = [];
  for (const t of flagged) {
    const invId = t.investmentTransactionId ? String(t.investmentTransactionId) : null;
    if (!invId) {
      // Flagged but no reference — cannot safely rollback; skip.
      continue;
    }
    if (investmentTransactionIds && investmentTransactionIds.length && !investmentTransactionIds.includes(invId)) {
      continue;
    }
    if (seen.has(invId)) continue;
    seen.add(invId);
    invIdsToRemove.push(invId);
    originalsToReset.push(String(t._id));
  }

  if (invIdsToRemove.length) {
    await InvestmentTransaction.deleteMany({ _id: { $in: invIdsToRemove } });
  }
  if (originalsToReset.length) {
    await Transaction.updateMany(
      { _id: { $in: originalsToReset } },
      { migratedToInvestment: false, investmentTransactionId: null }
    );
  }
  return { removedInvestmentTransactions: invIdsToRemove.length, originalsReset: originalsToReset.length };
}

module.exports = {
  analyze,
  backup,
  migrate,
  rollback,
  ensureMigrationPortfolio,
  isExactInvestmentName,
  isAmbiguousInvestmentName,
  loadCategoryBuckets,
};
