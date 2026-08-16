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

function tx(user, type, amount, date, category = null, categoryName = null, account = null, accountName = null) {
  behavior.transactions.push({ user, type, amount, date, category, categoryName, account, accountName });
}

/** Populate the category/account references the way Mongoose would. */
function populate(t) {
  return {
    ...t,
    category: t.category ? { _id: t.category, name: t.categoryName } : null,
    account: t.account ? { _id: t.account, name: t.accountName } : null,
  };
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
    if (match.account && match.account.$ne && t.account === null) return false;
    return true;
  });

  const group = pipeline.find((s) => s.$group);
  if (group && group.$group._id === null) {
    const total = rows.reduce((s, t) => s + (t.amount || 0), 0);
    return [{ _id: null, total }];
  }
  if (group) {
    const field = group.$group._id === '$account' ? 'account' : 'category';
    const by = new Map();
    for (const t of rows) {
      const key = String(t[field]);
      const cur =
        by.get(key) ||
        {
          _id: t[field],
          total: 0,
          name: field === 'account' ? t.accountName : t.categoryName || 'Food',
        };
      cur.total += t.amount || 0;
      by.set(key, cur);
    }
    const limit = pipeline.find((s) => s.$limit)?.$limit ?? 100;
    return [...by.values()].sort((a, b) => b.total - a.total).slice(0, limit);
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
        .map(populate)
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
stubModule('../models/FocusSession', { aggregate: async () => [{ _id: null, duration: 0 }] });

const aiContext = require('../services/aiContext');
const { buildFinancialContext, getFinancialSnapshot } = aiContext;

// ---------------------------------------------------------------------------
// Fixture: the user's six accounts summing to Rp755.000.
// ---------------------------------------------------------------------------
function seedAccounts() {
  behavior.accounts = [
    { user: USER, name: 'Seabank', type: 'bank', balance: 511000 },
    { user: USER, name: 'Mandiri', type: 'bank', balance: 13000 },
    { user: USER, name: 'Dana', type: 'ewallet', balance: 99000 },
    { user: USER, name: 'GoPay', type: 'ewallet', balance: 40000 },
    { user: USER, name: 'BNI', type: 'bank', balance: 89000 },
    { user: USER, name: 'Other', type: 'bank', balance: 3000 },
    { user: OTHER, name: "Rival's Money", type: 'investment', balance: 99999999 },
  ];
}

/**
 * The user's real account set (used for the net-worth / account-type tests):
 * total 63.409.000, liquid 845.000, investment 62.564.000.
 */
function seedRealAccounts() {
  behavior.accounts = [
    { user: USER, name: 'Ajaib', type: 'investment', balance: 62564000 },
    { user: USER, name: 'BCA', type: 'bank', balance: 661000 },
    { user: USER, name: 'Mandiri', type: 'bank', balance: 99000 },
    { user: USER, name: 'Dana', type: 'ewallet', balance: 40000 },
    { user: USER, name: 'GoPay', type: 'ewallet', balance: 26000 },
    { user: USER, name: 'Seabank', type: 'bank', balance: 13000 },
    { user: USER, name: 'BNI', type: 'bank', balance: 3000 },
    { user: USER, name: 'Cash', type: 'cash', balance: 3000 },
    { user: OTHER, name: "Rival's Money", type: 'investment', balance: 99999999 },
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
  assert.ok(context.includes('Account balances (name | type | balance):'), context);
  assert.ok(context.includes('- Seabank | bank | Rp\u00A0511.000'), context);
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

  assert.ok(
    captured.prompt.includes('Total balance across all accounts (net worth): 755.000'),
    captured.prompt
  );
  assert.ok(captured.prompt.includes('Net worth breakdown'), captured.prompt);
  assert.ok(captured.prompt.includes('Liquid (cash + bank + e-wallet): 755.000'), captured.prompt);
  assert.ok(captured.prompt.includes('Investment: 0'), captured.prompt);
  assert.ok(captured.prompt.includes('Net cash flow (income - expense, transfers excluded): -438.000'), captured.prompt);
  assert.ok(captured.prompt.includes('- Seabank | type: bank | 511.000'), captured.prompt);
  assert.ok(!captured.prompt.includes('Total balance across all accounts: 0'), captured.prompt);
  assert.strictEqual(result.success, true);
});

// ---------------------------------------------------------------------------
// Transaction context accuracy (account + exact category names).
// ---------------------------------------------------------------------------

const J = 'cat-jajan';
const BCA = 'acc-bca';
const DANA = 'acc-dana';

function expectedDate(d) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(d));
}

// T9 — AI transaction context contains the account name.
test('T9: transaction context contains the exact account name', async () => {
  reset();
  seedAccounts();
  const d = new Date(2026, 7, 17, 12);
  tx(USER, 'expense', 15000, d, J, 'Jajan', BCA, 'BCA');
  const context = await buildFinancialContext(USER);
  assert.ok(context.includes('account: BCA'), context);
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.recentTransactions[0].account, 'BCA');
});

// T10 — AI transaction context contains the exact category name.
test('T10: transaction context contains the exact category name', async () => {
  reset();
  seedAccounts();
  tx(USER, 'expense', 15000, new Date(2026, 7, 17, 12), J, 'Jajan', BCA, 'BCA');
  const context = await buildFinancialContext(USER);
  assert.ok(context.includes('category: Jajan'), context);
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.recentTransactions[0].category, 'Jajan');
});

// T11 — Category aggregation preserves the database category names.
test('T11: category aggregation preserves the stored category name', async () => {
  reset();
  seedAccounts();
  tx(USER, 'expense', 383000, monthMid(0), J, 'Jajan', BCA, 'BCA');
  tx(USER, 'expense', 15000, monthMid(0), J, 'Jajan', DANA, 'DANA');
  tx(USER, 'expense', 40000, monthMid(0), J, 'Jajan', DANA, 'DANA');
  const snap = await getFinancialSnapshot(USER);
  assert.deepStrictEqual(snap.categorySpending, [{ category: 'Jajan', amount: 438000 }]);
  const context = await buildFinancialContext(USER);
  assert.ok(context.includes('Spending by category'), context);
  assert.ok(context.includes('Jajan: Rp\u00A0438.000'), context);
});

// T12 — "Jajan" never becomes "Food & Drinks".
test('T12: "Jajan" is not renamed to "Food & Drinks" anywhere', async () => {
  reset();
  seedAccounts();
  tx(USER, 'expense', 383000, monthMid(0), J, 'Jajan', BCA, 'BCA');
  const context = await buildFinancialContext(USER);
  const snap = await getFinancialSnapshot(USER);
  assert.ok(context.includes('Jajan'), context);
  assert.ok(!context.includes('Food & Drinks'), context);
  assert.strictEqual(snap.categorySpending[0].category, 'Jajan');
  assert.ok(snap.categorySpending.every((c) => c.category !== 'Food & Drinks'));
});

// T13 — The account belongs to the current user (no cross-user leakage).
test('T13: another user\'s account never appears in the user\'s context', async () => {
  reset();
  seedAccounts();
  tx(OTHER, 'expense', 900000, monthMid(0), J, 'Jajan', 'acc-rival', "Rival's Account");
  tx(USER, 'expense', 15000, monthMid(0), J, 'Jajan', BCA, 'BCA');
  const context = await buildFinancialContext(USER);
  const snap = await getFinancialSnapshot(USER);
  assert.ok(!context.includes("Rival's Account"), context);
  assert.ok(snap.recentTransactions.every((t) => t.account !== "Rival's Account"));
  assert.ok(snap.accountSpending.every((a) => a.account !== "Rival's Account"));
  assert.strictEqual(snap.accountSpending[0].account, 'BCA');
});

// T14 — Missing account is reported as missing, not invented.
test('T14: missing account → "not recorded", never an invented name', async () => {
  reset();
  seedAccounts();
  tx(USER, 'expense', 15000, new Date(2026, 7, 17, 12), J, 'Jajan', null, null);
  const context = await buildFinancialContext(USER);
  assert.ok(context.includes('account: not recorded'), context);
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.recentTransactions[0].account, null);
});

// T15 — Transaction amount remains exact.
test('T15: transaction amount stays exact in the context', async () => {
  reset();
  seedAccounts();
  tx(USER, 'expense', 15000, new Date(2026, 7, 17, 12), J, 'Jajan', BCA, 'BCA');
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.recentTransactions[0].amount, 15000);
  const context = await buildFinancialContext(USER);
  assert.ok(context.includes('Rp\u00A015.000'), context);
});

// T16 — Transaction date remains exact.
test('T16: transaction date stays exact in the context', async () => {
  reset();
  seedAccounts();
  const d = new Date(2026, 7, 17, 12);
  tx(USER, 'expense', 15000, d, J, 'Jajan', BCA, 'BCA');
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.recentTransactions[0].date, expectedDate(d));
  const context = await buildFinancialContext(USER);
  assert.ok(context.includes(expectedDate(d)), context);
});

// T17 — Multiple transactions under the same category aggregate correctly,
// and per-account spending matches the requirement's expected numbers.
test('T17: Jajan = 438000 total; BCA 398000 + DANA 40000 per account', async () => {
  reset();
  seedAccounts();
  tx(USER, 'expense', 383000, monthMid(0), J, 'Jajan', BCA, 'BCA');
  tx(USER, 'expense', 15000, monthMid(0), J, 'Jajan', BCA, 'BCA');
  tx(USER, 'expense', 40000, monthMid(0), J, 'Jajan', DANA, 'DANA');
  const snap = await getFinancialSnapshot(USER);
  assert.deepStrictEqual(snap.categorySpending, [{ category: 'Jajan', amount: 438000 }]);
  assert.deepStrictEqual(snap.accountSpending, [
    { account: 'BCA', amount: 398000 },
    { account: 'DANA', amount: 40000 },
  ]);
  const sumAccount = snap.accountSpending.reduce((s, a) => s + a.amount, 0);
  assert.strictEqual(sumAccount, 438000);
});

// ---------------------------------------------------------------------------
// Net worth / account type — authoritative, shared, user-scoped.
// ---------------------------------------------------------------------------

const { buildGeneralContext } = aiContext;

test('T18: general chat context includes account type from Account.type', async () => {
  reset();
  seedRealAccounts();
  const context = await buildGeneralContext(USER);
  assert.ok(context.includes('- Ajaib | investment |'), context);
  assert.ok(context.includes('- BCA | bank |'), context);
  assert.ok(context.includes('- Dana | ewallet |'), context);
  assert.ok(context.includes('- Cash | cash |'), context);
});

test('T19: general chat context includes netWorth.total (63.409.000)', async () => {
  reset();
  seedRealAccounts();
  const context = await buildGeneralContext(USER);
  assert.ok(
    context.includes('Net worth (from stored account types, backend-calculated):'),
    context
  );
  assert.ok(context.includes('- Total: Rp\u00A063.409.000'), context);
});

test('T20: general chat context includes netWorth.liquid (845.000)', async () => {
  reset();
  seedRealAccounts();
  const context = await buildGeneralContext(USER);
  assert.ok(context.includes('- Liquid (cash + bank + e-wallet): Rp\u00A0845.000'), context);
});

test('T21: general chat context includes netWorth.investment (62.564.000)', async () => {
  reset();
  seedRealAccounts();
  const context = await buildGeneralContext(USER);
  assert.ok(context.includes('- Investment: Rp\u00A062.564.000'), context);
});

test('T22: general chat context includes the byType breakdown', async () => {
  reset();
  seedRealAccounts();
  const context = await buildGeneralContext(USER);
  assert.ok(context.includes('- By type:'), context);
  assert.ok(context.includes('  - investment: Rp\u00A062.564.000'), context);
  assert.ok(context.includes('  - bank: Rp\u00A0776.000'), context);
  assert.ok(context.includes('  - ewallet: Rp\u00A066.000'), context);
  assert.ok(context.includes('  - cash: Rp\u00A03.000'), context);
});

test('T23: account type comes from the stored Account.type value', async () => {
  reset();
  seedRealAccounts();
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.accounts.find((a) => a.name === 'Ajaib').type, 'investment');
  assert.strictEqual(snap.accounts.find((a) => a.name === 'BCA').type, 'bank');
  assert.strictEqual(snap.accounts.find((a) => a.name === 'Cash').type, 'cash');
});

test('T24: type is never inferred from the name; missing type → "not recorded"', async () => {
  reset();
  behavior.accounts = [
    { user: USER, name: 'Ajaib', type: 'investment', balance: 62564000 },
    { user: USER, name: 'Saham Jumbo', type: null, balance: 1000 },
  ];
  const context = await buildGeneralContext(USER);
  assert.ok(context.includes('- Ajaib | investment |'), context);
  assert.ok(context.includes('- Saham Jumbo | not recorded |'), context);
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.accounts.find((a) => a.name === 'Saham Jumbo').type, null);
});

test('T25: net worth never includes another user\'s accounts', async () => {
  reset();
  seedRealAccounts();
  const snap = await getFinancialSnapshot(USER);
  assert.strictEqual(snap.netWorth.total, 63409000);
  assert.strictEqual(snap.netWorth.liquid, 845000);
  assert.strictEqual(snap.netWorth.investment, 62564000);
  assert.ok(snap.netWorth.byType.every((t) => t.balance < 99999999));
  const context = await buildGeneralContext(USER);
  assert.ok(!context.includes("Rival's Money"), context);
});

test('T26: financial insight and general chat use the same financial snapshot', async () => {
  reset();
  seedRealAccounts();
  const snap = await getFinancialSnapshot(USER);
  const context = await buildGeneralContext(USER);
  assert.strictEqual(snap.netWorth.total, 63409000);
  assert.strictEqual(snap.netWorth.liquid, 845000);
  assert.strictEqual(snap.netWorth.investment, 62564000);
  assert.ok(context.includes('- Total: Rp\u00A063.409.000'), context);
  assert.ok(context.includes('- Liquid (cash + bank + e-wallet): Rp\u00A0845.000'), context);
  assert.ok(context.includes('- Investment: Rp\u00A062.564.000'), context);
});
