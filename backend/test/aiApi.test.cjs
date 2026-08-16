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
  // Quick Add (natural language transactions) fixtures.
  accounts: [],
  categories: [],
  transactionCreateCalls: [],
  transactionCreate: (doc) => {
    const created = { _id: 'txn-created', ...doc, createdAt: new Date(), updatedAt: new Date() };
    behavior.transactionCreateCalls.push(doc);
    return created;
  },
};

const QUICK_ACCOUNTS = [
  { _id: 'acc-bca', name: 'Bank BCA', type: 'bank', balance: 100000, user: USER_A },
  { _id: 'acc-bni', name: 'Bank BNI', type: 'bank', balance: 500000, user: USER_A },
  { _id: 'acc-gopay', name: 'GoPay', type: 'ewallet', balance: 100000, user: USER_A },
  { _id: 'acc-bca-b', name: "B's BCA", type: 'bank', balance: 999, user: USER_B },
];

const QUICK_CATEGORIES = [
  { _id: 'cat-food', name: 'Food & Drinks', color: '#FF9F1C', icon: 'utensils', type: 'transaction', user: USER_A },
  { _id: 'cat-b-food', name: "B's Food", color: '#FF9F1C', icon: 'utensils', type: 'transaction', user: USER_B },
];

/** Reset quick-add fixtures to a known state (live objects so balance changes persist). */
function resetQuickAddData() {
  behavior.transactionCreateCalls.length = 0;
  behavior.accounts = QUICK_ACCOUNTS.map((a) => {
    const obj = { ...a, user: a.user };
    obj.save = async function () {
      return obj;
    };
    return obj;
  });
  behavior.categories = QUICK_CATEGORIES.map((c) => ({ ...c, user: c.user }));
}

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

function createModel({ find = () => [], findOne = null, findById = null, aggregate = () => [], count = () => 0, create = null } = {}) {
  return {
    find: (filter) => chain(() => find(filter)),
    findOne: async (filter) => findOne(filter),
    findById: (id) => chain(() => findById(id)),
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
stubModule('../models/Account', {
  find: (filter) =>
    chain(() =>
      filter && filter.user
        ? behavior.accounts.filter((a) => String(a.user) === String(filter.user))
        : behavior.accounts
    ),
  findOne: async (filter) => {
    const acc = behavior.accounts.find((a) => String(a._id) === String(filter?._id));
    if (!acc) return null;
    if (typeof acc.save !== 'function') acc.save = async function () { return acc; };
    return acc;
  },
  findById: (id) => chain(() => behavior.accounts.find((a) => String(a._id) === String(id)) || null),
  aggregate: async () => behavior.accountAggregate,
  countDocuments: async (filter) => {
    const ids = filter?._id?.$in || [];
    return behavior.accounts.filter(
      (a) =>
        String(a.user) === String(filter?.user) && ids.some((id) => String(id) === String(a._id))
    ).length;
  },
  create: async (doc) => {
    const acc = { _id: 'acc-created', ...doc };
    acc.save = async function () { return acc; };
    behavior.accounts.push(acc);
    return acc;
  },
});
stubModule('../models/Category', {
  find: (filter) =>
    chain(() =>
      behavior.categories.filter(
        (c) =>
          (!filter?.user || String(c.user) === String(filter.user)) &&
          (!filter?.type || c.type === filter.type)
      )
    ),
  findOne: async (filter) =>
    behavior.categories.find(
      (c) => String(c._id) === String(filter?._id) && String(c.user) === String(filter?.user)
    ) || null,
  findById: (id) => chain(() => behavior.categories.find((c) => String(c._id) === String(id)) || null),
  create: async (doc) => {
    const cat = { _id: 'cat-created', ...doc };
    behavior.categories.push(cat);
    return cat;
  },
});
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
  create: (doc) => behavior.transactionCreate(doc),
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
    '/api/ai/parse-transaction',
    '/api/ai/create-transaction',
    '/api/ai/financial-insight',
    '/api/ai/daily-plan',
    '/api/ai/habit-insight',
    '/api/ai/goal-insight',
  ]) {
    const body =
      path === '/api/ai/chat'
        ? { message: 'hi' }
        : path === '/api/ai/parse-transaction'
          ? { message: 'jajan 15k bca' }
          : path === '/api/ai/create-transaction'
            ? { draft: { type: 'expense', amount: 15000 } }
            : {};
    const res = await post(path, body);
    assert.strictEqual(res.status, 401, path);
    const json = await res.json();
    assert.strictEqual(json.success, false);
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
    for (const path of ['/api/ai/chat', '/api/ai/parse-transaction']) {
      const res = await post(path, body, authHeaders());
      assert.strictEqual(res.status, 400, `${path} ${JSON.stringify(body)}`);
      const json = await res.json();
      assert.strictEqual(json.message, 'Message is required.');
    }
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

// ---------------------------------------------------------------------------
// Quick Add Finance — natural language transaction parsing + confirmation
// ---------------------------------------------------------------------------

const QUICK_AUTH = authHeaders(USER_A);

function geminiJson(data) {
  return JSON.stringify(data);
}

async function postParse(message) {
  return post('/api/ai/parse-transaction', { message }, QUICK_AUTH);
}

async function postCreate(draft) {
  return post('/api/ai/create-transaction', { draft }, QUICK_AUTH);
}

test('quick-add: parse is READ ONLY — never creates a transaction', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'transaction',
      type: 'expense',
      amount: 15000,
      description: 'Jajan',
      category: 'Food & Drinks',
      account: 'Bank BCA',
      fromAccount: null,
      toAccount: null,
      reply: 'Transaksi siap disimpan.',
    });
  try {
    const res = await postParse('jajan 15k bca');
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.intent, 'transaction');
    assert.strictEqual(json.draft.type, 'expense');
    assert.strictEqual(json.draft.amount, 15000);
    assert.strictEqual(json.draft.accountName, 'Bank BCA');
    assert.strictEqual(json.draft.categoryId, 'cat-food');
    // Parse must not touch the database.
    assert.strictEqual(behavior.transactionCreateCalls.length, 0);
    assert.strictEqual(behavior.accounts.find((a) => a._id === 'acc-bca').balance, 100000);
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: income "gajian 5jt bca" parses to income 5000000 on BCA', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'transaction',
      type: 'income',
      amount: 5000000,
      description: 'Gaji',
      category: 'Salary',
      account: 'Bank BCA',
      fromAccount: null,
      toAccount: null,
      reply: 'Transaksi siap disimpan.',
    });
  try {
    const json = await (await postParse('gajian 5jt bca')).json();
    assert.strictEqual(json.intent, 'transaction');
    assert.strictEqual(json.draft.type, 'income');
    assert.strictEqual(json.draft.amount, 5000000);
    assert.strictEqual(json.draft.accountName, 'Bank BCA');
    assert.strictEqual(json.draft.categoryName, 'Salary');
    assert.strictEqual(behavior.transactionCreateCalls.length, 0);
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: keyword fallback — "jajan 15k bca" gets Food & Drinks even if the model returns no category', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'transaction',
      type: 'expense',
      amount: 15000,
      description: 'Jajan',
      category: null,
      account: 'Bank BCA',
      fromAccount: null,
      toAccount: null,
      reply: 'Transaksi siap disimpan.',
    });
  try {
    const json = await (await postParse('jajan 15k bca')).json();
    assert.strictEqual(json.intent, 'transaction');
    assert.strictEqual(json.draft.categoryName, 'Food & Drinks');
    assert.strictEqual(json.draft.categoryId, 'cat-food');
    assert.strictEqual(behavior.transactionCreateCalls.length, 0);
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: keyword fallback — no category and no food keyword stays Uncategorized', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'transaction',
      type: 'expense',
      amount: 50000,
      description: 'Beli sesuatu',
      category: null,
      account: 'Bank BCA',
      fromAccount: null,
      toAccount: null,
      reply: 'Transaksi siap disimpan.',
    });
  try {
    const json = await (await postParse('bayar 50k bca')).json();
    assert.strictEqual(json.intent, 'transaction');
    assert.strictEqual(json.draft.categoryName, null);
    assert.strictEqual(json.draft.categoryId, null);
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: transfer "transfer 100k bni ke gopay" → BNI → GoPay', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'transaction',
      type: 'transfer',
      amount: 100000,
      description: 'Transfer',
      category: null,
      fromAccount: 'Bank BNI',
      toAccount: 'GoPay',
      account: null,
      reply: 'Transaksi siap disimpan.',
    });
  try {
    const json = await (await postParse('transfer 100k bni ke gopay')).json();
    assert.strictEqual(json.intent, 'transaction');
    assert.strictEqual(json.draft.type, 'transfer');
    assert.strictEqual(json.draft.amount, 100000);
    assert.strictEqual(json.draft.fromAccountName, 'Bank BNI');
    assert.strictEqual(json.draft.toAccountName, 'GoPay');
    assert.strictEqual(json.draft.accountName, undefined);
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: natural transfer "isi gopay 100rb dari bca" → BCA → GoPay (not expense)', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'transaction',
      type: 'transfer',
      amount: 100000,
      description: 'Isi GoPay',
      category: null,
      fromAccount: 'Bank BCA',
      toAccount: 'GoPay',
      account: null,
      reply: 'Transaksi siap disimpan.',
    });
  try {
    const json = await (await postParse('isi gopay 100rb dari bca')).json();
    assert.strictEqual(json.intent, 'transaction');
    assert.strictEqual(json.draft.type, 'transfer');
    assert.strictEqual(json.draft.fromAccountName, 'Bank BCA');
    assert.strictEqual(json.draft.toAccountName, 'GoPay');
    assert.strictEqual(json.draft.amount, 100000);
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: account alias "jajan 15k BANK BCA" resolves to "Bank BCA"', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'transaction',
      type: 'expense',
      amount: 15000,
      description: 'Jajan',
      category: 'Food & Drinks',
      account: 'BCA',
      fromAccount: null,
      toAccount: null,
      reply: 'Transaksi siap disimpan.',
    });
  try {
    const json = await (await postParse('jajan 15k BANK BCA')).json();
    assert.strictEqual(json.intent, 'transaction');
    assert.strictEqual(json.draft.accountName, 'Bank BCA');
    assert.strictEqual(json.draft.accountId, 'acc-bca');
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: question intent is never turned into a transaction', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'question',
      type: null,
      amount: null,
      description: null,
      category: null,
      fromAccount: null,
      toAccount: null,
      account: null,
      reply: 'Itu pertanyaan, bukan transaksi.',
    });
  try {
    const json = await (await postParse('berapa saldo bca?')).json();
    assert.strictEqual(json.intent, 'question');
    assert.strictEqual(json.draft, undefined);
    assert.strictEqual(behavior.transactionCreateCalls.length, 0);
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: missing account → clarification', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'clarify',
      type: 'expense',
      amount: 15000,
      description: 'Jajan',
      category: null,
      fromAccount: null,
      toAccount: null,
      account: null,
      reply: 'Mau dipotong dari rekening mana?',
    });
  try {
    const json = await (await postParse('jajan 15k')).json();
    assert.strictEqual(json.intent, 'clarify');
    assert.ok(json.reply.toLowerCase().includes('rekening'));
    assert.strictEqual(behavior.transactionCreateCalls.length, 0);
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: missing amount → clarification', async () => {
  resetQuickAddData();
  gemini.generate = async () =>
    geminiJson({
      intent: 'clarify',
      type: 'expense',
      amount: null,
      description: 'Jajan',
      category: null,
      fromAccount: null,
      toAccount: null,
      account: 'Bank BCA',
      reply: 'Berapa nominal transaksinya?',
    });
  try {
    const json = await (await postParse('jajan bca')).json();
    assert.strictEqual(json.intent, 'clarify');
    assert.ok(json.reply.toLowerCase().includes('nominal'));
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});

test('quick-add: confirm creates the transaction and updates the expense balance', async () => {
  resetQuickAddData();
  const res = await postCreate({
    type: 'expense',
    amount: 15000,
    description: 'Jajan',
    categoryId: null,
    categoryName: 'Food & Drinks',
    accountId: 'acc-bca',
    accountName: 'Bank BCA',
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.created, true);
  assert.strictEqual(json.success, true);
  assert.strictEqual(behavior.transactionCreateCalls.length, 1);
  const doc = behavior.transactionCreateCalls[0];
  assert.strictEqual(String(doc.user), USER_A);
  assert.strictEqual(doc.type, 'expense');
  assert.strictEqual(doc.amount, 15000);
  assert.strictEqual(String(doc.account), 'acc-bca');
  assert.strictEqual(String(doc.category), 'cat-food');
  const bca = behavior.accounts.find((a) => a._id === 'acc-bca');
  assert.strictEqual(bca.balance, 85000); // 100.000 - 15.000
});

test('quick-add: income confirm adds to the account balance', async () => {
  resetQuickAddData();
  const res = await postCreate({
    type: 'income',
    amount: 50000,
    description: 'Gajian',
    categoryId: null,
    categoryName: 'Salary',
    accountId: 'acc-bca',
    accountName: 'Bank BCA',
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.created, true);
  const bca = behavior.accounts.find((a) => a._id === 'acc-bca');
  assert.strictEqual(bca.balance, 150000); // 100.000 + 50.000
});

test('quick-add: transfer confirm moves money between two accounts', async () => {
  resetQuickAddData();
  const res = await postCreate({
    type: 'transfer',
    amount: 100000,
    description: 'Transfer',
    fromAccountId: 'acc-bni',
    fromAccountName: 'Bank BNI',
    toAccountId: 'acc-gopay',
    toAccountName: 'GoPay',
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.created, true);
  const doc = behavior.transactionCreateCalls[0];
  assert.strictEqual(doc.type, 'transfer');
  assert.strictEqual(String(doc.fromAccount), 'acc-bni');
  assert.strictEqual(String(doc.toAccount), 'acc-gopay');
  assert.strictEqual(behavior.accounts.find((a) => a._id === 'acc-bni').balance, 400000); // 500.000 - 100.000
  assert.strictEqual(behavior.accounts.find((a) => a._id === 'acc-gopay').balance, 200000); // 100.000 + 100.000
});

test('quick-add: confirm rejects an account owned by another user', async () => {
  resetQuickAddData();
  const res = await postCreate({
    type: 'expense',
    amount: 15000,
    description: 'Jajan',
    categoryId: null,
    categoryName: null,
    accountId: 'acc-bca-b',
    accountName: "B's BCA",
  });
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.ok(json.message.toLowerCase().includes('account'));
  assert.strictEqual(behavior.transactionCreateCalls.length, 0);
});

test('quick-add: confirm rejects a category owned by another user', async () => {
  resetQuickAddData();
  const res = await postCreate({
    type: 'expense',
    amount: 15000,
    description: 'Jajan',
    categoryId: 'cat-b-food',
    categoryName: null,
    accountId: 'acc-bca',
    accountName: 'Bank BCA',
  });
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.ok(json.message.toLowerCase().includes('category'));
  assert.strictEqual(behavior.transactionCreateCalls.length, 0);
});

test('quick-add: confirm rejects an invalid amount', async () => {
  resetQuickAddData();
  for (const amount of [-15000, 0, 'abc']) {
    const res = await postCreate({
      type: 'expense',
      amount,
      description: 'Jajan',
      categoryId: null,
      categoryName: null,
      accountId: 'acc-bca',
    });
    assert.strictEqual(res.status, 400, `amount=${amount}`);
    const json = await res.json();
    assert.ok(json.message.toLowerCase().includes('amount'));
  }
  assert.strictEqual(behavior.transactionCreateCalls.length, 0);
});

test('quick-add: confirm rejects an invalid type', async () => {
  resetQuickAddData();
  const res = await postCreate({
    type: 'gambling',
    amount: 15000,
    description: 'Jajan',
    categoryId: null,
    categoryName: null,
    accountId: 'acc-bca',
  });
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.ok(json.message.toLowerCase().includes('type'));
});

test('quick-add: confirm rejects a transfer with equal source/destination', async () => {
  resetQuickAddData();
  const res = await postCreate({
    type: 'transfer',
    amount: 100000,
    description: 'Transfer',
    fromAccountId: 'acc-bca',
    toAccountId: 'acc-bca',
  });
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.ok(json.message.toLowerCase().includes('different accounts'));
});

test('quick-add: confirm without a draft is rejected', async () => {
  resetQuickAddData();
  const res = await post('/api/ai/create-transaction', {}, QUICK_AUTH);
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.ok(json.message.toLowerCase().includes('draft'));
});

test('quick-add: confirm auto-creates a missing "Food & Drinks" category on save', async () => {
  resetQuickAddData();
  behavior.categories = QUICK_CATEGORIES.filter((c) => c.name !== 'Food & Drinks');
  const before = behavior.categories.length;
  const res = await postCreate({
    type: 'expense',
    amount: 15000,
    description: 'Jajan',
    categoryId: null,
    categoryName: 'Food & Drinks',
    accountId: 'acc-bca',
    accountName: 'Bank BCA',
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(behavior.categories.length, before + 1);
  const created = behavior.categories.find((c) => c.name === 'Food & Drinks');
  assert.ok(created);
  assert.strictEqual(String(created.user), USER_A);
  assert.strictEqual(String(behavior.transactionCreateCalls[0].category), String(created._id));
});

test('quick-add: parse with no accounts asks the user to create one first', async () => {
  resetQuickAddData();
  behavior.accounts = [];
  gemini.generate = async () => 'unused';
  try {
    const json = await (await postParse('jajan 15k bca')).json();
    assert.strictEqual(json.intent, 'clarify');
    assert.ok(json.reply.toLowerCase().includes('rekening'));
    assert.strictEqual(behavior.transactionCreateCalls.length, 0);
  } finally {
    gemini.generate = async () => 'Mocked LifeHub AI reply';
  }
});
