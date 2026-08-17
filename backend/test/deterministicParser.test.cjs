// Tests for deterministic query router + deterministic quick-add parser.
//
// Guards that simple lookup queries and simple transactions are answered
// WITHOUT calling Gemini. Complex/ambiguous inputs fall back to Gemini.

const { test } = require('node:test');
const assert = require('node:assert');

const USER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';

/** Same format as the router uses — matches Intl.NumberFormat 'id-ID' currency. */
const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const fmt = (n) => IDR.format(Number(n) || 0);

// ── Stub infrastructure ─────────────────────────────────────────────────────

const behavior = {
  transactions: [],
  accounts: [],
  categories: [],
};

function reset() {
  behavior.transactions.length = 0;
  behavior.accounts.length = 0;
  behavior.categories.length = 0;
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
    if (match.account && typeof match.account === 'string' && String(t.account) !== String(match.account)) return false;
    if (match.category && typeof match.category === 'string' && String(t.category) !== String(match.category)) return false;
    return true;
  });

  const group = pipeline.find((s) => s.$group);
  if (group && group.$group._id === null) {
    const total = rows.reduce((s, t) => s + (t.amount || 0), 0);
    return [{ _id: null, total, count: rows.length }];
  }
  if (group) {
    const field = group.$group._id === '$account' ? 'account' : 'category';
    const by = new Map();
    for (const t of rows) {
      const key = String(t[field] || 'none');
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

// Model stubs
stubModule('../models/Transaction', {
  find: (filter) =>
    chain(() =>
      behavior.transactions
        .filter((t) => (filter?.user ? String(t.user) === String(filter.user) : true))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(populate)
        .slice(0, filter?.limit || Infinity)
    ),
  countDocuments: async (filter) => {
    return behavior.transactions.filter((t) => {
      if (filter?.user && String(t.user) !== String(filter.user)) return false;
      if (filter?.date) {
        const d = new Date(t.date).getTime();
        if (filter.date.$gte && d < new Date(filter.date.$gte).getTime()) return false;
        if (filter.date.$lt && d >= new Date(filter.date.$lt).getTime()) return false;
      }
      return true;
    }).length;
  },
  aggregate: async (pipeline) => simulateAggregate(pipeline),
});
stubModule('../models/Account', {
  find: (filter) =>
    chain(() =>
      behavior.accounts.filter((a) => String(a.user) === String(filter?.user))
    ),
});
stubModule('../models/Category', {
  find: (filter) =>
    chain(() =>
      behavior.categories.filter((c) => String(c.user) === String(filter?.user))
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

// ── Deterministic router ────────────────────────────────────────────────────
const deterministicRouter = require('../services/deterministicRouter');

// ── Deterministic quick-add parser ──────────────────────────────────────────
const { deterministicParse, tryDeterministicQuickAdd } = require('../services/aiTransactionService');

// ── Fixture data ────────────────────────────────────────────────────────────
function seedAccounts() {
  behavior.accounts = [
    { _id: 'acc-bca', user: USER, name: 'BCA', type: 'bank', balance: 661000 },
    { _id: 'acc-mandiri', user: USER, name: 'Mandiri', type: 'bank', balance: 99000 },
    { _id: 'acc-dana', user: USER, name: 'Dana', type: 'ewallet', balance: 40000 },
    { _id: 'acc-gopay', user: USER, name: 'GoPay', type: 'ewallet', balance: 26000 },
    { _id: 'acc-seabank', user: USER, name: 'Seabank', type: 'bank', balance: 13000 },
    { _id: 'acc-bni', user: USER, name: 'BNI', type: 'bank', balance: 3000 },
    { _id: 'acc-ajaib', user: USER, name: 'Ajaib', type: 'investment', balance: 62564000 },
    { _id: 'acc-cash', user: USER, name: 'Cash', type: 'cash', balance: 3000 },
    { _id: 'acc-rival-bca', user: OTHER, name: "Rival's BCA", type: 'bank', balance: 99999999 },
  ];
}

function seedCategories() {
  behavior.categories = [
    { user: USER, name: 'Food & Drinks', color: '#FF9F1C', type: 'transaction' },
    { user: USER, name: 'Transport', color: '#3A86FF', type: 'transaction' },
    { user: USER, name: 'Salary', color: '#06D6A0', type: 'transaction' },
  ];
}

function seedTransactions() {
  const now = new Date();
  behavior.transactions = [
    { user: USER, type: 'expense', amount: 50000, date: new Date(now.getFullYear(), now.getMonth(), 5), category: null, categoryName: 'Food & Drinks', account: 'acc-bca', accountName: 'BCA' },
    { user: USER, type: 'expense', amount: 30000, date: new Date(now.getFullYear(), now.getMonth(), 10), category: null, categoryName: 'Transport', account: 'acc-mandiri', accountName: 'Mandiri' },
    { user: USER, type: 'income', amount: 5000000, date: new Date(now.getFullYear(), now.getMonth(), 1), category: null, categoryName: 'Salary', account: 'acc-bca', accountName: 'BCA' },
    { user: OTHER, type: 'expense', amount: 99999, date: new Date(now.getFullYear(), now.getMonth(), 5), category: null, categoryName: 'Food', account: 'acc-rival-bca', accountName: "Rival's BCA" },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// TEST 1: "berapa saldo BCA?" → deterministic, no Gemini
// ────────────────────────────────────────────────────────────────────────────
test('T1: deterministic account balance lookup — "berapa saldo BCA?"', async () => {
  reset();
  seedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'berapa saldo BCA?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('BCA'));
  assert.ok(result.reply.includes(fmt(661000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 2: "saldo Ajaib?" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T2: deterministic account balance — "saldo Ajaib?"', async () => {
  reset();
  seedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'saldo Ajaib?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('Ajaib'));
  assert.ok(result.reply.includes(fmt(62564000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 3: "berapa net worth saya?" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T3: deterministic net worth — "berapa net worth saya?"', async () => {
  reset();
  seedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'berapa net worth saya?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes(fmt(63409000)));
  assert.ok(result.reply.includes('Liquid'));
  assert.ok(result.reply.includes('Investasi'));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 4: "berapa pengeluaran bulan ini?" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T4: deterministic month expense — "berapa pengeluaran bulan ini?"', async () => {
  reset();
  seedAccounts();
  seedTransactions();
  const result = await deterministicRouter.handleQuery(USER, 'berapa pengeluaran bulan ini?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes(fmt(80000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 5: ambiguous question → falls back to Gemini
// ────────────────────────────────────────────────────────────────────────────
test('T5: ambiguous question falls back to Gemini', async () => {
  reset();
  seedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'bagaimana kondisi keuangan saya secara keseluruhan?');
  assert.strictEqual(result.handled, false);
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 6: "jajan 15k bca" → deterministic parse
// ────────────────────────────────────────────────────────────────────────────
test('T6: deterministic quick-add — "jajan 15k bca"', async () => {
  reset();
  seedAccounts();
  seedCategories();
  const accounts = behavior.accounts.filter((a) => a.user === USER);
  const categories = behavior.categories.filter((c) => c.user === USER);
  const result = tryDeterministicQuickAdd('jajan 15k bca', accounts, categories);
  assert.ok(result, 'should parse deterministically');
  assert.strictEqual(result.intent, 'transaction');
  assert.strictEqual(result.draft.type, 'expense');
  assert.strictEqual(result.draft.amount, 15000);
  assert.ok(result.draft.accountName.includes('BCA'));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 7: "gajian 5jt bca" → deterministic parse
// ────────────────────────────────────────────────────────────────────────────
test('T7: deterministic quick-add — "gajian 5jt bca"', async () => {
  reset();
  seedAccounts();
  seedCategories();
  const accounts = behavior.accounts.filter((a) => a.user === USER);
  const categories = behavior.categories.filter((c) => c.user === USER);
  const result = tryDeterministicQuickAdd('gajian 5jt bca', accounts, categories);
  assert.ok(result, 'should parse deterministically');
  assert.strictEqual(result.intent, 'transaction');
  assert.strictEqual(result.draft.type, 'income');
  assert.strictEqual(result.draft.amount, 5000000);
  assert.ok(result.draft.accountName.includes('BCA'));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 8: "transfer 100k bni ke gopay" → deterministic parse
// ────────────────────────────────────────────────────────────────────────────
test('T8: deterministic quick-add — "transfer 100k bni ke gopay"', async () => {
  reset();
  seedAccounts();
  seedCategories();
  const accounts = behavior.accounts.filter((a) => a.user === USER);
  const categories = behavior.categories.filter((c) => c.user === USER);
  const result = tryDeterministicQuickAdd('transfer 100k bni ke gopay', accounts, categories);
  assert.ok(result, 'should parse deterministically');
  assert.strictEqual(result.intent, 'transaction');
  assert.strictEqual(result.draft.type, 'transfer');
  assert.strictEqual(result.draft.amount, 100000);
  assert.ok(result.draft.fromAccountName.includes('BNI'));
  assert.ok(result.draft.toAccountName.includes('GoPay'));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 9: ambiguous natural-language transaction → null (Gemini fallback)
// ────────────────────────────────────────────────────────────────────────────
test('T9: ambiguous transaction returns null for Gemini fallback', async () => {
  reset();
  seedAccounts();
  seedCategories();
  const accounts = behavior.accounts.filter((a) => a.user === USER);
  const result = tryDeterministicQuickAdd('I went to the store and bought some stuff yesterday', accounts, behavior.categories);
  assert.strictEqual(result, null, 'ambiguous NL should return null');
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 10: security — User A cannot access User B's accounts
// ────────────────────────────────────────────────────────────────────────────
test('T10: security — User B cannot see User A BCA', async () => {
  reset();
  seedAccounts();
  // OTHER user has "Rival's BCA" in their own accounts (from seedAccounts).
  // When OTHER asks "berapa saldo BCA?", they should NOT see USER's "BCA"
  // account (balance 661000). The Account.find({ user: OTHER }) only returns
  // OTHER's own accounts, so user scoping is guaranteed.
  const result = await deterministicRouter.handleQuery(OTHER, 'berapa saldo BCA?');
  if (result.handled) {
    // OTHER may match their own "Rival's BCA" — that's fine (own account).
    // But must NOT contain USER's balance.
    assert.ok(!result.reply.includes(fmt(661000)),
      'OTHER must not see USER BCA balance');
  }
  // In either case, OTHER cannot see USER's data.
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 11: "total saldo saya?" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T11: deterministic total balance — "total saldo saya?"', async () => {
  reset();
  seedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'total saldo saya?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes(fmt(63409000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 12: "transaksi terakhir saya?" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T12: deterministic recent transactions — "transaksi terakhir saya?"', async () => {
  reset();
  seedAccounts();
  seedTransactions();
  const result = await deterministicRouter.handleQuery(USER, 'transaksi terakhir saya?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('terakhir'));
  assert.ok(!result.reply.includes("Rival"));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 13: "berapa liquid assets?" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T13: deterministic liquid assets — "berapa liquid assets?"', async () => {
  reset();
  seedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'berapa liquid assets?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes(fmt(845000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 14: "berapa investasi saya?" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T14: deterministic investment — "berapa investasi saya?"', async () => {
  reset();
  seedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'berapa investasi saya?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes(fmt(62564000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 15: deterministicParse amount variants
// ────────────────────────────────────────────────────────────────────────────
test('T15: deterministicParse handles amount variants correctly', () => {
  const accounts = [
    { _id: 'a1', name: 'BCA', type: 'bank' },
    { _id: 'a2', name: 'Mandiri', type: 'bank' },
  ];

  let r = deterministicParse('jajan 15k bca', accounts);
  assert.strictEqual(r.amount, 15000);

  r = deterministicParse('jajan 15rb bca', accounts);
  assert.strictEqual(r.amount, 15000);

  r = deterministicParse('jajan 15.000 bca', accounts);
  assert.strictEqual(r.amount, 15000);

  r = deterministicParse('jajan 15000 bca', accounts);
  assert.strictEqual(r.amount, 15000);

  r = deterministicParse('beli barang 1,5jt bca', accounts);
  assert.strictEqual(r.amount, 1500000);

  r = deterministicParse('beli barang 1.5jt bca', accounts);
  assert.strictEqual(r.amount, 1500000);

  r = deterministicParse('gajian 5jt mandiri', accounts);
  assert.strictEqual(r.amount, 5000000);

  r = deterministicParse('gajian 5 juta mandiri', accounts);
  assert.strictEqual(r.amount, 5000000);
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 16: "berapa pengeluaran BCA?" → deterministic account expense
// ────────────────────────────────────────────────────────────────────────────
test('T16: deterministic account expense — "berapa pengeluaran BCA?"', async () => {
  reset();
  seedAccounts();
  seedTransactions();
  const result = await deterministicRouter.handleQuery(USER, 'berapa pengeluaran BCA?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('BCA'));
  assert.ok(result.reply.includes(fmt(50000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 17: "uang di mandiri" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T17: deterministic balance — "uang di mandiri"', async () => {
  reset();
  seedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'uang di mandiri');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('Mandiri'));
  assert.ok(result.reply.includes(fmt(99000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 18: transfer with same account → falls back to Gemini (ambiguous)
// ────────────────────────────────────────────────────────────────────────────
test('T18: transfer to same account returns null', () => {
  const accounts = [
    { _id: 'a1', name: 'BCA', type: 'bank' },
  ];
  const result = tryDeterministicQuickAdd('transfer 100k bca ke bca', accounts, []);
  assert.strictEqual(result, null, 'same account transfer should return null');
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 19: "berapa transaksi bulan ini?" → deterministic tx count
// ────────────────────────────────────────────────────────────────────────────
test('T19: deterministic tx count — "berapa transaksi bulan ini?"', async () => {
  reset();
  seedAccounts();
  seedTransactions();
  const result = await deterministicRouter.handleQuery(USER, 'berapa transaksi bulan ini?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('3'));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 20: "bca saya ada berapa" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T20: deterministic balance — "bca saya ada berapa"', async () => {
  reset();
  seedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'bca saya ada berapa');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('BCA'));
  assert.ok(result.reply.includes(fmt(661000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 21: "berapa pemasukan bulan ini?" → deterministic
// ────────────────────────────────────────────────────────────────────────────
test('T21: deterministic month income — "berapa pemasukan bulan ini?"', async () => {
  reset();
  seedAccounts();
  seedTransactions();
  const result = await deterministicRouter.handleQuery(USER, 'berapa pemasukan bulan ini?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes(fmt(5000000)));
});

// ────────────────────────────────────────────────────────────────────────────
// TEST 22: short message → not handled
// ────────────────────────────────────────────────────────────────────────────
test('T22: very short message returns not handled', async () => {
  const result = await deterministicRouter.handleQuery(USER, 'hi');
  assert.strictEqual(result.handled, false);
});

// ────────────────────────────────────────────────────────────────────────────
// T23–T31: Account alias matching regression tests (Bank BCA prefix pattern)
// ────────────────────────────────────────────────────────────────────────────

/** Seed accounts where BCA is named "Bank BCA" (prefix pattern). */
function seedBankPrefixedAccounts() {
  behavior.accounts = [
    { _id: 'acc-bca', user: USER, name: 'Bank BCA', type: 'bank', balance: 661000 },
    { _id: 'acc-mandiri', user: USER, name: 'Bank Mandiri', type: 'bank', balance: 99000 },
    { _id: 'acc-dana', user: USER, name: 'Dana', type: 'ewallet', balance: 40000 },
    { _id: 'acc-gopay', user: USER, name: 'GoPay', type: 'ewallet', balance: 26000 },
    { _id: 'acc-seabank', user: USER, name: 'Seabank', type: 'bank', balance: 13000 },
    { _id: 'acc-bni', user: USER, name: 'Bank BNI', type: 'bank', balance: 3000 },
    { _id: 'acc-ajaib', user: USER, name: 'Ajaib', type: 'investment', balance: 62564000 },
    { _id: 'acc-cash', user: USER, name: 'Cash', type: 'cash', balance: 3000 },
  ];
}

test('T23: "berapa saldo BCA?" resolves to Bank BCA (prefix name)', async () => {
  reset();
  seedBankPrefixedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'berapa saldo BCA?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('Bank BCA'));
  assert.ok(result.reply.includes(fmt(661000)));
});

test('T24: "saldo BCA" resolves to Bank BCA', async () => {
  reset();
  seedBankPrefixedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'saldo BCA');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('Bank BCA'));
  assert.ok(result.reply.includes(fmt(661000)));
});

test('T25: "uang di BCA berapa?" resolves to Bank BCA', async () => {
  reset();
  seedBankPrefixedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'uang di BCA berapa?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('Bank BCA'));
  assert.ok(result.reply.includes(fmt(661000)));
});

test('T26: "berapa saldo Bank BCA?" resolves to Bank BCA (full name)', async () => {
  reset();
  seedBankPrefixedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'berapa saldo Bank BCA?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('Bank BCA'));
  assert.ok(result.reply.includes(fmt(661000)));
});

test('T27: "berapa saldo Mandiri?" resolves to Bank Mandiri', async () => {
  reset();
  seedBankPrefixedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'berapa saldo Mandiri?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('Bank Mandiri'));
  assert.ok(result.reply.includes(fmt(99000)));
});

test('T28: "berapa saldo GoPay?" resolves to GoPay (no prefix)', async () => {
  reset();
  seedBankPrefixedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'berapa saldo GoPay?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('GoPay'));
  assert.ok(result.reply.includes(fmt(26000)));
});

test('T29: "berapa saldo Dana?" resolves to Dana (no prefix)', async () => {
  reset();
  seedBankPrefixedAccounts();
  const result = await deterministicRouter.handleQuery(USER, 'berapa saldo Dana?');
  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('Dana'));
  assert.ok(result.reply.includes(fmt(40000)));
});

test('T30: multi-account ambiguity — "saldo BCA" with Bank BCA + My BCA', async () => {
  reset();
  // Both accounts end with "BCA" at a word boundary — true ambiguity.
  behavior.accounts = [
    { _id: 'acc-bca1', user: USER, name: 'Bank BCA', type: 'bank', balance: 661000 },
    { _id: 'acc-bca2', user: USER, name: 'My BCA', type: 'bank', balance: 500000 },
  ];
  const result = await deterministicRouter.handleQuery(USER, 'saldo BCA');
  assert.strictEqual(result.handled, true, 'should still be handled (clarification)')
  assert.ok(
    result.reply.includes('beberapa rekening') || result.reply.includes('lebih spesifik'),
    'should ask for clarification'
  );
});

test('T31: user isolation — User B cannot see User A Bank BCA via alias', async () => {
  reset();
  seedBankPrefixedAccounts();
  const result = await deterministicRouter.handleQuery(OTHER, 'berapa saldo BCA?');
  assert.strictEqual(result.handled, false, 'OTHER user should not find Bank BCA');
});
