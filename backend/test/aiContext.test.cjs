// LifeHub financial AI context tests.
//
// Guards the "AI analysis must reflect backend numbers" fix:
//   - totalBalance is summed from the Account collection (the same source of
//     truth as the Finance page), so it can never be NaN→Rp0.
//   - income/expense only count income/expense transactions; transfers are
//     excluded from cash flow.
//   - current vs previous month ranges do not overlap.
//   - everything is scoped to the authenticated user (no cross-user leakage).
//   - the AI prompt embeds the exact system-calculated figures.
//
// Models are stubbed via require.cache (no DB, no network).

const { test } = require('node:test');
const assert = require('node:assert');

const USER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';

// In-memory "database" for transactions and accounts.
const behavior = {
  transactions: [],
  accounts: [],
};

function reset() {
  behavior.transactions.length = 0;
  behavior.accounts.length = 0;
}

function chain(getDocs) {
  const q = {
    sort() { return q; },
    limit() { return q; },
    populate() { return q; },
    select() { return q; },
    lean() { return q; },
    then(resolve) { resolve(getDocs()); },
  };
  return q;
}

function stubModule(relativePath, exportsObj) {
  const resolved = require.resolve(relativePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsObj,
  };
}

function monthMid(offset) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 15);
}

function tx(user, type, amount, date, category = null, categoryName = null) {
  behavior.transactions.push({ user, type, amount, date, category, categoryName });
}

function simulateAggregate(pipeline) {
  const match = pipeline[0]?.$match || {};
  const rows = behavior.transactions.filter((t) => {
    if (match.user && String(t.user) !== String(match.user)) return false;
    if (match.type && t.type !== match.type) return false;
    if (match.date) {
      const d = new Date(t.date).getTime();
      if (match.date.$gte && d < new Date(match.date.$gte).getTime()) return false;
      if (match.date.$lt && d >= new Date(match.date.$lt).getTime()) return false;
    }
    if (match.category && match.category.$ne && t.category === null) return false;
    return true;
  });

  const group = pipeline.find((s) => s.$group);
  if (group && group.$group._id === null) {
    const total = rows.reduce((s, t) => s + (t.amount || 0), 0);
    return [{ _id: null, total }];
  }
  if (group) {
    const byCat = new Map();
    for (const t of rows) {
      const key = String(t.category);
      const cur = byCat.get(key) || { _id: t.category, total: 0, name: t.categoryName || 'Food' };
      cur.total += t.amount || 0;
      byCat.set(key, cur);
    }
    const limit = pipeline.find((s) => s.$limit)?.$limit ?? 100;
    return [...byCat.values()].sort((a, b) => b.total - a.total).slice(0, limit);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Model stubs.
// ---------------------------------------------------------------------------
stubModule('../models/Transaction', {
  find: (filter) =>
    chain(() =>
      behavior.transactions
        .filter((t) => (filter?.user ? String(t.user) === String(filter.user) : true))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, filter?.limit || Infinity)
    ),
  aggregate: async (pipeline) => simulateAggregate(pipeline),
});
stubModule('../models/Account', {
  find: (filter) =>
    chain(() =>
      behavior.accounts.filter((a) => String(a.user) === String(filter?.user))
    ),
});
stubModule('../models/Budget', { find: () => chain(() => []) });
stubModule('../models/Goal', { find: () => chain(() => []) });
stubModule('../models/Task', { find: () => chain(() => []) });
stubModule('../models/Habit', { find: () => chain(() => []) });
stubModule('../models/Reminder', { find: () => chain(() => []) });
stubModule('../models/Setting', { findOne: async () => null });
stubModule('../models/User', { findById: () => chain(() => null) });

const aiContext = require('../services/aiContext');
const { buildFinancialContext, getFinancialSnapshot } = aiContext;

// ---------------------------------------------------------------------------
// Fixture: the user's six accounts summing to Rp755.000.
// ---------------------------------------------------------------------------
function seedAccounts() {
  behavior.accounts = [
    { user: USER, name: 'Seabank', balance: 511000 },
    { user: USER, name: 'Mandiri', balance: 13000 },
    { user: USER, name: 'Dana', balance: 99000 },
    { user: USER, name: 'GoPay', balance: 40000 },
    { user: USER, name: 'BNI', balance: 89000 },
    { user: USER, name: 'Other', balance: 3000 },
    { user: OTHER, name: "Rival's Money", balance: 99999999 },
  ];
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

// Test 1 — Account Balance: sum of stored balances = 755.000 (never NaN→Rp0).
test('T1: totalBalance = sum of the user\'s stored account balances (755000)', async () => {
  reset();
  seedAccounts();
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.totalBalance, 755000);
  assert.strictEqual(snap.accounts.length, 6);
  assert.strictEqual(snap.accounts.find((a) => a.name === 'Seabank').balance, 511000);

  const context = await buildFinancialContext(USER);
  assert.ok(context.includes('755.000'), context);
  assert.ok(context.includes('Account balances:'), context);
  assert.ok(context.includes('511.000'), context);
});

// Test 2 — Zero income but positive balance.
test('T2: zero income + positive balance → balance stays 755000, net = -438000', async () => {
  reset();
  seedAccounts();
  tx(USER, 'expense', 438000, monthMid(0));
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.totalBalance, 755000);
  assert.strictEqual(snap.currentMonthIncome, 0);
  assert.strictEqual(snap.currentMonthExpense, 438000);
  assert.strictEqual(snap.netCashFlow, -438000);
});

// Test 3 — Expense.
test('T3: currentMonthExpense = 438000 from expense transactions only', async () => {
  reset();
  seedAccounts();
  tx(USER, 'expense', 383000, monthMid(0));
  tx(USER, 'expense', 15000, monthMid(0));
  tx(USER, 'expense', 40000, monthMid(0));
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.currentMonthExpense, 438000);
});

// Test 4 — Transfer: never income/expense.
test('T4: transfer 100000 does NOT affect income, expense or cash flow', async () => {
  reset();
  seedAccounts();
  tx(USER, 'transfer', 100000, monthMid(0));
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.currentMonthIncome, 0);
  assert.strictEqual(snap.currentMonthExpense, 0);
  assert.strictEqual(snap.netCashFlow, 0);
});

// Test 5 — Income: net = income - expense.
test('T5: income 5000000 + expense 438000 → netCashFlow = 4562000', async () => {
  reset();
  seedAccounts();
  tx(USER, 'income', 5000000, monthMid(0));
  tx(USER, 'expense', 438000, monthMid(0));
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.currentMonthIncome, 5000000);
  assert.strictEqual(snap.netCashFlow, 4562000);
});

// Test 6 — Previous month must not leak into the current month.
test('T6: previous-month transactions do not affect current month figures', async () => {
  reset();
  seedAccounts();
  tx(USER, 'income', 1000000, monthMid(-1));
  tx(USER, 'expense', 200000, monthMid(-1));
  tx(USER, 'expense', 50000, monthMid(0));
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.currentMonthIncome, 0);
  assert.strictEqual(snap.currentMonthExpense, 50000);
  assert.strictEqual(snap.previousMonthIncome, 1000000);
  assert.strictEqual(snap.previousMonthExpense, 200000);
});

// Test 7 — User isolation.
test('T7: another user\'s accounts/transactions are never included', async () => {
  reset();
  seedAccounts();
  tx(OTHER, 'income', 50000000, monthMid(0));
  tx(USER, 'income', 100000, monthMid(0));
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.totalBalance, 755000);
  assert.strictEqual(snap.currentMonthIncome, 100000);
  assert.ok(snap.accounts.every((a) => a.name !== "Rival's Money"));
});

// Test 8 — AI numeric consistency: the prompt embeds backend numbers verbatim.
test('T8: financial-insight prompt embeds exact backend figures', async () => {
  reset();
  seedAccounts();
  tx(USER, 'expense', 438000, monthMid(0));

  const captured = { prompt: '', configured: true };
  stubModule('../services/geminiService', {
    isConfigured: () => captured.configured,
    generate: async (prompt) => {
      captured.prompt = prompt;
      return 'ok';
    },
  });

  const aiController = require('../controllers/aiController');
  let result;
  await aiController.financialInsight(
    { user: { _id: USER } },
    { json: (v) => { result = v; } },
    (err) => { throw err; }
  );

  assert.ok(captured.prompt.includes('Total balance across all accounts: 755.000'), captured.prompt);
  assert.ok(captured.prompt.includes('Net cash flow (income - expense, transfers excluded): -438.000'), captured.prompt);
  assert.ok(captured.prompt.includes('- Seabank: 511.000'), captured.prompt);
  assert.ok(!captured.prompt.includes('Total balance across all accounts: 0'), captured.prompt);
  assert.strictEqual(result.success, true);
});
