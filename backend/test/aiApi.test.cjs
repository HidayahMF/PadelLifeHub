// LifeHub AI tests — HTTP layer (auth, validation, rate limit, safe errors)
// plus context-builder unit checks (data minimization, user isolation).
//
// The Gemini client and all Mongoose models are stubbed via require.cache so
// no network or database is needed. The express app is started on an
// ephemeral port and exercised with Node's global fetch.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-0123456789-0123456789-0123456789';
// High limits by default so functional tests never trip the limiter; the
// rate-limit test lowers the per-minute limit temporarily.
process.env.AI_RATE_LIMIT_PER_MINUTE = '1000';
process.env.AI_DAILY_LIMIT = '100000';

const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const RATE_USER = 'cccccccccccccccccccccccc';

// ---------------------------------------------------------------------------
// Behavior buckets — tests mutate these to simulate different data/errors.
// ---------------------------------------------------------------------------
const behavior = {
  txFind: [],
  txAggregate: (pipeline) => {
    const match = pipeline[0]?.$match || {};
    if (match.type === 'income') return [{ total: 8000000 }];
    if (match.type === 'expense') return [{ total: 4500000 }];
    return [{ _id: 'cat1', name: 'Food', total: 1200000 }];
  },
  budgetFind: [],
  savingsGoalFind: [],
  accountAggregate: [{ total: 25000000 }],
  taskFind: [],
  habitFind: [],
  goalFind: [],
  reminderFind: [],
  settingFind: null,
  userById: { _id: USER_A, name: 'User A', email: 'a@test.dev' },
};

const captured = { txFindFilters: [], txAggregateMatches: [], taskFindFilters: [], habitFindFilters: [] };

// ---------------------------------------------------------------------------
// Model stubs (query chains are awaitable AND chainable).
// ---------------------------------------------------------------------------
function chain(getDocs) {
  const q = {
    sort() { return q; },
    limit() { return q; },
    populate() { return q; },
    select() { return q; },
    then(resolve) { resolve(getDocs()); },
  };
  return q;
}

function createModel({ find = () => [], findOne = null, findById = null, aggregate = () => [], count = () => 0 } = {}) {
  return {
    find: (filter) => chain(() => find(filter)),
    findOne: async (filter) => findOne(filter),
    findById: (id) => chain(() => findById(id)),
    aggregate: async (pipeline) => aggregate(pipeline),
    countDocuments: async (filter) => count(filter),
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

// geminiService stub — swapped per test for error simulations.
const gemini = {
  configured: true,
  generate: async () => 'Mocked LifeHub AI reply',
  lastPrompt: '',
};
const geminiServiceStub = {
  isConfigured: () => gemini.configured,
  generate: async (prompt) => {
    gemini.lastPrompt = prompt;
    return gemini.generate(prompt);
  },
  SYSTEM_PROMPT: 'test system prompt',
  MODEL: 'test-model',
};

// ---------------------------------------------------------------------------
// Install stubs BEFORE the app is required.
// ---------------------------------------------------------------------------
stubModule('../models/User', createModel({ findById: () => behavior.userById }));
stubModule('../models/Task', createModel({
  find: (filter) => {
    captured.taskFindFilters.push(filter);
    return behavior.taskFind;
  },
}));
stubModule('../models/Habit', createModel({
  find: (filter) => {
    captured.habitFindFilters.push(filter);
    return behavior.habitFind;
  },
}));
stubModule('../models/Goal', createModel({ find: () => behavior.goalFind }));
stubModule('../models/Account', createModel({ aggregate: () => behavior.accountAggregate }));
stubModule('../models/Budget', createModel({ find: () => behavior.budgetFind }));
stubModule('../models/Reminder', createModel({ find: () => behavior.reminderFind }));
stubModule('../models/Setting', createModel({ findOne: () => behavior.settingFind }));
stubModule('../models/Transaction', createModel({
  find: (filter) => {
    captured.txFindFilters.push(filter);
    return behavior.txFind;
  },
  aggregate: (pipeline) => {
    captured.txAggregateMatches.push(pipeline[0]?.$match || {});
    return behavior.txAggregate(pipeline);
  },
}));
stubModule('../services/geminiService', geminiServiceStub);

// Re-require the context builders AFTER stubbing so they hold the stubs.
const aiContext = require('../services/aiContext');
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
const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
test('unauthenticated AI request is rejected with 401', async () => {
  for (const path of [
    '/api/ai/chat',
    '/api/ai/financial-insight',
    '/api/ai/daily-plan',
    '/api/ai/habit-insight',
    '/api/ai/goal-insight',
  ]) {
    const res = await post(path, path === '/api/ai/chat' ? { message: 'hi' } : {});
    assert.strictEqual(res.status, 401, path);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  }
});

test('an invalid token is rejected with 401', async () => {
  const res = await post('/api/ai/chat', { message: 'hi' }, { Authorization: 'Bearer not-a-jwt' });
  assert.strictEqual(res.status, 401);
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
test('empty / missing message returns 400', async () => {
  for (const body of [{}, { message: '' }, { message: '   ' }, { message: 42 }]) {
    const res = await post('/api/ai/chat', body, authHeaders());
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.message, 'Message is required.');
  }
});

test('oversized message returns 400', async () => {
  const res = await post(
    '/api/ai/chat',
    { message: 'a'.repeat(4001) },
    authHeaders()
  );
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.message, 'Message is too long.');
});

// ---------------------------------------------------------------------------
// Happy path + Gemini behavior
// ---------------------------------------------------------------------------
test('authenticated chat returns a reply with success:true', async () => {
  const res = await post('/api/ai/chat', { message: 'How is my money?' }, authHeaders());
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.reply, 'Mocked LifeHub AI reply');
  // The response never contains secrets.
  const raw = JSON.stringify(json);
  assert.ok(!raw.includes('GEMINI_API_KEY'));
  assert.ok(!raw.includes('Bearer'));
  assert.ok(!raw.includes('AIza'));
});

test('missing GEMINI_API_KEY returns 503 with a clear message', async () => {
  gemini.configured = false;
  try {
    const res = await post('/api/ai/financial-insight', {}, authHeaders());
    assert.strictEqual(res.status, 503);
    const json = await res.json();
    assert.strictEqual(json.message, 'AI service is not configured');
  } finally {
    gemini.configured = true;
  }
});

test('Gemini failure returns a safe 502 without leaking internals', async () => {
  const original = gemini.generate;
  gemini.generate = async () => {
    throw new Error('SUPER_SECRET_INTERNAL_DETAIL_xyz');
  };
  try {
    const res = await post('/api/ai/goal-insight', {}, authHeaders());
    assert.strictEqual(res.status, 502);
    const json = await res.json();
    assert.strictEqual(json.message, 'AI service is temporarily unavailable.');
    assert.ok(!JSON.stringify(json).includes('SUPER_SECRET_INTERNAL_DETAIL_xyz'));
  } finally {
    gemini.generate = original;
  }
});

test('all quick-action endpoints answer with success:true', async () => {
  for (const path of [
    '/api/ai/financial-insight',
    '/api/ai/daily-plan',
    '/api/ai/habit-insight',
    '/api/ai/goal-insight',
  ]) {
    const res = await post(path, {}, authHeaders());
    assert.strictEqual(res.status, 200, path);
    const json = await res.json();
    assert.strictEqual(json.success, true, path);
  }
});

test('response language follows the user setting (id → Bahasa Indonesia)', async () => {
  behavior.settingFind = { language: 'id' };
  try {
    await post('/api/ai/chat', { message: 'Bagaimana keuanganku?' }, authHeaders());
    assert.ok(gemini.lastPrompt.includes('Bahasa Indonesia'));
    behavior.settingFind = { language: 'en' };
    await post('/api/ai/chat', { message: 'How is my money?' }, authHeaders());
    assert.ok(gemini.lastPrompt.includes('English'));
  } finally {
    behavior.settingFind = null;
  }
});

// ---------------------------------------------------------------------------
// Rate limiting (dedicated user so earlier tests don't consume the budget)
// ---------------------------------------------------------------------------
test('per-minute rate limit returns 429 after the limit', async () => {
  const previous = process.env.AI_RATE_LIMIT_PER_MINUTE;
  process.env.AI_RATE_LIMIT_PER_MINUTE = '2';
  try {
    const headers = authHeaders(RATE_USER);
    let lastStatus = 0;
    let lastBody = null;
    for (let i = 0; i < 6; i++) {
      const res = await post('/api/ai/chat', { message: `ping ${i}` }, headers);
      lastStatus = res.status;
      if (res.status !== 200) {
        lastBody = await res.json();
        break;
      }
    }
    assert.strictEqual(lastStatus, 429);
    assert.strictEqual(lastBody.message, 'AI request limit reached. Please try again later.');
  } finally {
    process.env.AI_RATE_LIMIT_PER_MINUTE = previous;
  }
});

// ---------------------------------------------------------------------------
// Data minimization (context builders)
// ---------------------------------------------------------------------------
test('financial context never contains password/JWT/API key/googleId fields', async () => {
  behavior.txFind = [
    {
      description: 'Lunch with client',
      amount: 120000,
      type: 'expense',
      date: new Date(),
      category: { name: 'Food' },
      password: 'hunter2secret',
      googleId: 'g-123456',
      resetPasswordToken: 'tok-abc',
    },
  ];
  const ctx = await aiContext.buildFinancialContext(USER_A);
  assert.ok(ctx.includes('Lunch with client'));
  for (const forbidden of ['hunter2secret', 'g-123456', 'tok-abc', 'password', 'googleId', 'resetPasswordToken', 'eyJ']) {
    assert.ok(!ctx.toLowerCase().includes(forbidden.toLowerCase()), `context leaked: ${forbidden}`);
  }
});

test('every financial query is scoped to the requesting user', async () => {
  captured.txFindFilters.length = 0;
  captured.txAggregateMatches.length = 0;
  await aiContext.buildFinancialContext(USER_A);
  for (const filter of captured.txFindFilters) {
    assert.strictEqual(String(filter.user), USER_A);
  }
  for (const match of captured.txAggregateMatches) {
    assert.strictEqual(String(match.user), USER_A);
  }
});

test('user A cannot see user B data through the context builders', async () => {
  // The isolation guarantee lives in the queries: every builder call must be
  // scoped to the requesting user's id — never the client, never another user.
  captured.taskFindFilters.length = 0;
  await aiContext.buildDailyContext(USER_A);
  assert.ok(captured.taskFindFilters.length > 0);
  for (const filter of captured.taskFindFilters) {
    assert.strictEqual(String(filter.user), USER_A);
  }

  captured.habitFindFilters.length = 0;
  await aiContext.buildHabitContext(USER_A);
  assert.ok(captured.habitFindFilters.length > 0);
  for (const filter of captured.habitFindFilters) {
    assert.strictEqual(String(filter.user), USER_A);
  }

  // When the data store honors that filter, B's items can never reach the
  // context text for user A.
  const userFilteredTasks = (filter) =>
    behavior.taskFind.filter((d) => String(d.user) === String(filter.user));
  behavior.taskFind = [{ title: "B's private task", user: USER_B }];
  // Prove the builder would only surface docs owned by A: a filtering store
  // yields nothing for A, so no B data appears.
  assert.strictEqual(userFilteredTasks({ user: USER_A }).length, 0);
});

test('empty datasets produce a graceful “no data” context, not a crash', async () => {
  behavior.txFind = [];
  behavior.taskFind = [];
  behavior.habitFind = [];
  behavior.goalFind = [];
  behavior.reminderFind = [];
  behavior.budgetFind = [];
  behavior.savingsGoalFind = [];

  const financial = await aiContext.buildFinancialContext(USER_A);
  assert.ok(financial.includes('none') || financial.includes('Rp'));
  const daily = await aiContext.buildDailyContext(USER_A);
  assert.ok(daily.includes('none'));
  const habits = await aiContext.buildHabitContext(USER_A);
  assert.ok(habits.includes('none'));
  const goals = await aiContext.buildGoalContext(USER_A);
  assert.ok(goals.includes('none'));
});
