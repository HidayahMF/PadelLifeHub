// LifeHub finance-intelligence tests:
//   - computeFinancialHealth: transparent scoring (weights, no-data → null)
//   - GET /api/insights: net worth breakdown (liquid vs investment), health score
//   - GET /api/monthly-review: deterministic monthly stats
//   - POST /api/monthly-review/ai-summary: only backend figures reach the AI
//
// Models are stubbed via require.cache (no DB, no network), following the
// same pattern as aiApi.test.cjs / reminderScheduler.test.cjs.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-0123456789-0123456789-0123456789';

const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';

// ---------------------------------------------------------------------------
// Behavior buckets.
// ---------------------------------------------------------------------------
const behavior = {
  txAggregate: (pipeline) => {
    const match = pipeline[0]?.$match || {};
    const group = pipeline.find((s) => s.$group);
    const isTypeGroup = group && '_id' in group.$group && group.$group._id === '$type';
    if (isTypeGroup) {
      if (match.type === 'income') return [{ _id: 'income', total: 10000000 }];
      if (match.type === 'expense') return [{ _id: 'expense', total: 4500000 }];
      // untyped group (insights: all types grouped by $type)
      return [
        { _id: 'income', total: 10000000 },
        { _id: 'expense', total: 4500000 },
        { _id: 'transfer', total: 200000 },
      ];
    }
    // totals grouped by null (income/expense sums for a month)
    if (group && group.$group._id === null) {
      if (match.type === 'income') return [{ _id: null, total: 10000000 }];
      if (match.type === 'expense') return [{ _id: null, total: 4500000 }];
      return [];
    }
    // cash-flow by month
    if (group && group.$group._id && group.$group._id.$dateToString) {
      return [
        { _id: '2026-07', income: 9000000, expense: 4000000 },
        { _id: '2026-08', income: 10000000, expense: 4500000 },
      ];
    }
    return [];
  },
  txFind: [],
  budgetFind: [],
  categoryFind: [],
  accountAggregate: [
    { _id: 'bank', total: 5000000 },
    { _id: 'ewallet', total: 300000 },
    { _id: 'cash', total: 150000 },
    { _id: 'investment', total: 30000000 },
  ],
  taskCount: 0,
  taskFind: [],
  habitFind: [],
  goalCount: 0,
  settingFind: null,
  geminiReply: 'Mocked monthly review',
};

function reset() {
  behavior.txAggregate = (pipeline) => {
    const match = pipeline[0]?.$match || {};
    const group = pipeline.find((s) => s.$group);
    const isTypeGroup = group && '_id' in group.$group && group.$group._id === '$type';
    if (isTypeGroup) {
      if (match.type === 'income') return [{ _id: 'income', total: 10000000 }];
      if (match.type === 'expense') return [{ _id: 'expense', total: 4500000 }];
      return [
        { _id: 'income', total: 10000000 },
        { _id: 'expense', total: 4500000 },
        { _id: 'transfer', total: 200000 },
      ];
    }
    if (group && group.$group._id === null) {
      if (match.type === 'income') return [{ _id: null, total: 10000000 }];
      if (match.type === 'expense') return [{ _id: null, total: 4500000 }];
      return [];
    }
    if (group && group.$group._id && group.$group._id.$dateToString) {
      return [
        { _id: '2026-07', income: 9000000, expense: 4000000 },
        { _id: '2026-08', income: 10000000, expense: 4500000 },
      ];
    }
    return [];
  };
  behavior.txFind = [];
  behavior.budgetFind = [];
  behavior.categoryFind = [];
  behavior.accountAggregate = [
    { _id: 'bank', total: 5000000 },
    { _id: 'ewallet', total: 300000 },
    { _id: 'cash', total: 150000 },
    { _id: 'investment', total: 30000000 },
  ];
  behavior.taskCount = 0;
  behavior.taskFind = [];
  behavior.habitFind = [];
  behavior.goalCount = 0;
  behavior.settingFind = null;
  behavior.geminiReply = 'Mocked monthly review';
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

function createModel({
  find = () => [],
  findOne = null,
  aggregate = () => [],
  count = () => 0,
  create = null,
} = {}) {
  return {
    find: (filter) => chain(() => find(filter)),
    findOne: async (filter) => (findOne ? findOne(filter) : null),
    aggregate: async (pipeline) => aggregate(pipeline),
    countDocuments: async (filter) => count(filter),
    create: async (doc) => create(doc),
  };
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

stubModule('../models/User', {
  findById: () => chain(() => ({ _id: USER_A, name: 'User A', email: 'a@test.dev' })),
});
stubModule('../models/Transaction', createModel({
  find: (filter) => chain(() => behavior.txFind),
  aggregate: (pipeline) => behavior.txAggregate(pipeline),
}));
stubModule('../models/Budget', createModel({ find: () => behavior.budgetFind }));
stubModule('../models/Category', createModel({ find: () => behavior.categoryFind }));
stubModule('../models/Account', createModel({ aggregate: () => behavior.accountAggregate }));
stubModule('../models/Task', createModel({
  find: () => chain(() => behavior.taskFind),
  countDocuments: () => behavior.taskCount,
}));
stubModule('../models/Habit', createModel({ find: () => behavior.habitFind }));
stubModule('../models/Goal', createModel({ countDocuments: () => behavior.goalCount }));
stubModule('../models/Setting', createModel({ findOne: () => behavior.settingFind }));
stubModule('../models/FocusSession', createModel({
  // Focus time is now part of the monthly review; return zero by default.
  aggregate: async () => [{ _id: null, count: 0, duration: 0 }],
}));

const gemini = { lastPrompt: '' };
stubModule('../services/geminiService', {
  isConfigured: () => true,
  generate: async (prompt) => {
    gemini.lastPrompt = prompt;
    return behavior.geminiReply;
  },
});

const { computeFinancialHealth } = require('../controllers/insightsController');
const app = require('../app');

let server;
let base;

before(() => {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
});

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
const authHeaders = (id = USER_A) => ({ Authorization: `Bearer ${tokenFor(id)}` });
const get = (path, headers = {}) =>
  fetch(`${base}${path}`, { headers: { ...authHeaders(), ...headers } });
const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// Financial Health Score (pure function)
// ---------------------------------------------------------------------------
test('health score: no data at all → null (never a misleading 0)', () => {
  const h = computeFinancialHealth({
    thisIncome: 0,
    thisExpense: 0,
    lastIncome: 0,
    lastExpense: 0,
    savingsRate: 0,
    liquidAssets: 0,
    budget: { count: 0, totalBudget: 0, pct: 0, overBudget: [] },
  });
  assert.strictEqual(h, null);
});

test('health score: income > expense produces a good score with explainable dimensions', () => {
  const h = computeFinancialHealth({
    thisIncome: 10000000,
    thisExpense: 4500000,
    lastIncome: 9000000,
    lastExpense: 4000000,
    savingsRate: 55,
    liquidAssets: 5450000,
    budget: { count: 1, totalBudget: 6000000, pct: 50, overBudget: [] },
  });
  assert.ok(h);
  assert.ok(h.score >= 60, `expected decent score, got ${h.score}`);
  assert.strictEqual(h.dimensions.length, 5);
  const weights = h.dimensions.reduce((s, d) => s + d.weight, 0);
  assert.strictEqual(weights, 100);
  for (const d of h.dimensions) {
    assert.ok(d.score >= 0 && d.score <= 100);
    assert.ok(typeof d.detail === 'string' && d.detail.length > 0);
  }
  assert.ok(h.disclaimer.includes('not financial advice'));
});

test('health score: spending without income is penalized', () => {
  const h = computeFinancialHealth({
    thisIncome: 0,
    thisExpense: 500000,
    lastIncome: 0,
    lastExpense: 0,
    savingsRate: 0,
    liquidAssets: 1000000,
    budget: { count: 0, totalBudget: 0, pct: 0, overBudget: [] },
  });
  assert.ok(h);
  assert.strictEqual(h.dimensions.find((d) => d.key === 'cashFlow').score, 0);
  assert.ok(h.score < 60);
});

// ---------------------------------------------------------------------------
// GET /api/insights — net worth + health score
// ---------------------------------------------------------------------------
test('insights: net worth splits liquid vs investment by account type', async () => {
  reset();
  const res = await get('/api/insights');
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.netWorth.total, 35450000); // 5jt + 300rb + 150rb + 30jt
  assert.strictEqual(json.netWorth.liquid, 5450000); // bank + ewallet + cash
  assert.strictEqual(json.netWorth.investment, 30000000);
  assert.strictEqual(json.netWorth.byType.length, 4);
  const investment = json.netWorth.byType.find((t) => t.type === 'investment');
  assert.ok(Math.abs(investment.pct - 84.6) < 0.2);
  // Transfers are irrelevant to balance math but never income/expense:
  assert.ok(json.income.thisMonth >= json.expense.thisMonth);
});

test('insights: health score is present once transactions exist', async () => {
  reset();
  const res = await get('/api/insights');
  const json = await res.json();
  assert.ok(json.financialHealth);
  assert.ok(json.financialHealth.score >= 0 && json.financialHealth.score <= 100);
});

test('insights: health score is null with zero transactions', async () => {
  reset();
  behavior.txAggregate = (pipeline) => {
    const match = pipeline[0]?.$match || {};
    const group = pipeline.find((s) => s.$group);
    const isTypeGroup = group && '_id' in group.$group && group.$group._id === '$type';
    if (isTypeGroup) return [];
    return [];
  };
  try {
    const res = await get('/api/insights');
    const json = await res.json();
    assert.strictEqual(json.financialHealth, null);
  } finally {
    reset();
  }
});

// ---------------------------------------------------------------------------
// GET /api/monthly-review
// ---------------------------------------------------------------------------
test('monthly review: deterministic stats for the current month', async () => {
  reset();
  behavior.taskCount = 5;
  behavior.taskFind = [
    { _id: 't1', user: USER_A, status: 'completed', dueDate: new Date() },
  ];
  behavior.habitFind = [
    {
      _id: 'h1',
      user: USER_A,
      frequency: 'daily',
      bestStreak: 7,
      completedDates: ['2026-08-01', '2026-08-02'],
    },
  ];
  behavior.goalCount = 1;

  const res = await get('/api/monthly-review');
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.ok(json.month);
  assert.ok(json.monthLabel);
  assert.strictEqual(json.finance.income, 10000000);
  assert.strictEqual(json.finance.expense, 4500000);
  assert.strictEqual(json.finance.saved, 5500000);
  assert.strictEqual(json.netWorth.total, 35450000);
  assert.strictEqual(json.netWorth.liquid, 5450000);
  assert.ok(Array.isArray(json.budgetPerformance));
  assert.ok(Array.isArray(json.topCategories));
});

test('monthly review: unauthorized access rejected', async () => {
  const res = await fetch(`${base}/api/monthly-review`);
  assert.strictEqual(res.status, 401);
});

// ---------------------------------------------------------------------------
// POST /api/monthly-review/ai-summary
// ---------------------------------------------------------------------------
test('monthly review AI summary embeds backend figures, never raw docs', async () => {
  reset();
  const res = await post('/api/monthly-review/ai-summary', {});
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.reply, 'Mocked monthly review');
  assert.ok(gemini.lastPrompt.includes('10.000.000')); // income figure verbatim
  assert.ok(gemini.lastPrompt.includes('35.450.000')); // total balance verbatim
  assert.ok(gemini.lastPrompt.includes('What went well'));
  assert.ok(!gemini.lastPrompt.includes('password'));
});
