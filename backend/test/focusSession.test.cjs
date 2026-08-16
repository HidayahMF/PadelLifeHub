// LifeHub focus-session (Pomodoro) tests:
//   - POST /api/focus-sessions: completed + interrupted sessions, idempotency,
//     validation, user isolation
//   - GET /api/focus-sessions/stats: today / this week / this month buckets
//   - weekly + monthly review include focus time (backend-computed)
//   - AI: buildFocusContext + FACT/INSIGHT/RECOMMENDATION prompt structure
//
// Models are stubbed via require.cache (no DB, no network), following the
// same pattern as financeInsights.test.cjs.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-0123456789-0123456789-0123456789';

const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

// ---------------------------------------------------------------------------
// In-memory FocusSession store (the stubbed model's backing data).
// ---------------------------------------------------------------------------
const focusStore = new Map(); // `${user}:${clientId}` -> doc
let focusSeq = 1;

function resetFocus() {
  focusStore.clear();
  focusSeq = 1;
}

/** Seed a session directly into the store (bypasses API validation on purpose). */
function seedFocus({ user, clientId, startTime, duration, status = 'completed' }) {
  const start = new Date(startTime);
  const doc = {
    _id: `fs${focusSeq++}`,
    user,
    clientId,
    startTime: start,
    endTime: new Date(start.getTime() + duration * 1000),
    duration,
    status,
    taskId: null,
    createdAt: new Date(),
  };
  focusStore.set(`${user}:${clientId}`, doc);
  return doc;
}

// ---------------------------------------------------------------------------
// Behavior buckets for the non-focus models the touched controllers use.
// ---------------------------------------------------------------------------
const behavior = {
  txAggregate: (pipeline) => {
    const match = pipeline[0]?.$match || {};
    const group = pipeline.find((s) => s.$group);
    if (group && group.$group._id === null) {
      if (match.type === 'income') return [{ _id: null, total: 10000000 }];
      if (match.type === 'expense') return [{ _id: null, total: 4500000 }];
      return [];
    }
    return [];
  },
  txFind: [],
  budgetFind: [],
  categoryFind: [],
  taskCount: 0,
  taskFind: [],
  habitFind: [],
  goalCount: 0,
  accountAggregate: [
    { _id: 'bank', total: 5000000 },
    { _id: 'ewallet', total: 300000 },
    { _id: 'cash', total: 150000 },
    { _id: 'investment', total: 30000000 },
  ],
  settingFind: null,
  geminiReply: 'Mocked reply',
};

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

function createModel({ find = () => [], findOne = null, aggregate = () => [], count = () => 0 } = {}) {
  return {
    find: (filter) => chain(() => find(filter)),
    findOne: async (filter) => (findOne ? findOne(filter) : null),
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

// Auth: the user object is derived from the JWT id so isolation tests work.
stubModule('../models/User', {
  findById: (id) => chain(() => ({ _id: id, name: 'Test User', email: 't@test.dev' })),
});

// FocusSession backed by the in-memory store, including duplicate-key throws
// so the controller's idempotency path (unique index on user+clientId) is real.
stubModule('../models/FocusSession', {
  findOne: async (filter) => {
    for (const d of focusStore.values()) {
      if (String(d.user) === String(filter.user) && d.clientId === filter.clientId) return d;
    }
    return null;
  },
  create: async (doc) => {
    const key = `${doc.user}:${doc.clientId}`;
    if (focusStore.has(key)) {
      const err = new Error('duplicate key');
      err.code = 11000;
      throw err;
    }
    const saved = { _id: `fs${focusSeq++}`, ...doc, createdAt: new Date() };
    focusStore.set(key, saved);
    return saved;
  },
  find: (filter) =>
    chain(() =>
      [...focusStore.values()].filter(
        (d) => String(d.user) === String(filter.user) && (!filter.status || d.status === filter.status)
      )
    ),
  aggregate: async (pipeline) => {
    const match = pipeline[0]?.$match || {};
    const gte = match.startTime?.$gte ?? -Infinity;
    const lt = match.startTime?.$lt ?? Infinity;
    const docs = [...focusStore.values()].filter(
      (d) => String(d.user) === String(match.user) && d.startTime >= gte && d.startTime < lt
    );
    return [
      {
        _id: null,
        count: docs.length,
        duration: docs.reduce((s, d) => s + d.duration, 0),
      },
    ];
  },
});

stubModule('../models/WeeklyReview', createModel());
stubModule('../models/Transaction', createModel({
  find: (filter) => chain(() => behavior.txFind),
  aggregate: (pipeline) => behavior.txAggregate(pipeline),
}));
stubModule('../models/Budget', createModel({ find: () => behavior.budgetFind }));
stubModule('../models/Category', createModel({ find: () => behavior.categoryFind }));
stubModule('../models/Account', createModel({
  find: () => chain(() => []),
  aggregate: () => behavior.accountAggregate,
}));
stubModule('../models/Task', createModel({
  find: () => chain(() => behavior.taskFind),
  countDocuments: () => behavior.taskCount,
}));
stubModule('../models/Habit', createModel({ find: () => behavior.habitFind }));
stubModule('../models/Goal', createModel({ countDocuments: () => behavior.goalCount }));
stubModule('../models/Setting', createModel({ findOne: () => behavior.settingFind }));

const gemini = { lastPrompt: '' };
stubModule('../services/geminiService', {
  isConfigured: () => true,
  generate: async (prompt) => {
    gemini.lastPrompt = prompt;
    return behavior.geminiReply;
  },
});

const { buildFocusContext } = require('../services/aiContext');
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
const get = (path, id = USER_A) => fetch(`${base}${path}`, { headers: authHeaders(id) });
const post = (path, body, id = USER_A) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(id) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** Freeze `new Date()` (zero-arg) to a fixed WIB instant for bucket tests. */
async function withFrozenNow(frozenLocalISO, fn) {
  const RealDate = global.Date;
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(frozenLocalISO);
      else super(...args);
    }
    static now() {
      return new MockDate().getTime();
    }
  }
  global.Date = MockDate;
  try {
    return await fn();
  } finally {
    global.Date = RealDate;
  }
}

// ---------------------------------------------------------------------------
// POST /api/focus-sessions
// ---------------------------------------------------------------------------
test('focus session: completed session is stored with backend-owned userId', async () => {
  resetFocus();
  const now = Date.now();
  const res = await post('/api/focus-sessions', {
    clientId: 'c1',
    startTime: new Date(now - 25 * 60 * 1000).toISOString(),
    endTime: new Date(now).toISOString(),
    duration: 1500,
    status: 'completed',
  });
  assert.strictEqual(res.status, 201);
  const json = await res.json();
  assert.strictEqual(json.user, USER_A); // userId comes from the JWT, not the body
  assert.strictEqual(json.duration, 1500);
  assert.strictEqual(json.status, 'completed');
  assert.ok(json.clientId === 'c1');
});

test('focus session: duplicate clientId is idempotent (no second session)', async () => {
  resetFocus();
  const now = Date.now();
  const body = {
    clientId: 'c-dup',
    startTime: new Date(now - 600 * 1000).toISOString(),
    endTime: new Date(now).toISOString(),
    duration: 600,
    status: 'interrupted',
  };
  const first = await (await post('/api/focus-sessions', body)).json();
  assert.strictEqual(first.status, 'interrupted');

  const secondRes = await post('/api/focus-sessions', body);
  assert.strictEqual(secondRes.status, 200); // replay returns the stored doc, not 201
  const second = await secondRes.json();
  assert.strictEqual(second._id, first._id);

  const list = await (await get('/api/focus-sessions')).json();
  assert.strictEqual(list.length, 1);
});

test('focus session: validation rejects missing duration, future start, oversized duration', async () => {
  resetFocus();
  const now = Date.now();
  const missing = await post('/api/focus-sessions', { clientId: 'x', startTime: new Date(now).toISOString() });
  assert.strictEqual(missing.status, 400);

  const future = await post('/api/focus-sessions', {
    clientId: 'x',
    startTime: new Date(now + 3600_000).toISOString(),
    duration: 100,
  });
  assert.strictEqual(future.status, 400);

  const huge = await post('/api/focus-sessions', {
    clientId: 'x',
    startTime: new Date(now - 1000).toISOString(),
    duration: 999999,
  });
  assert.strictEqual(huge.status, 400);

  const noClient = await post('/api/focus-sessions', {
    startTime: new Date(now - 1000).toISOString(),
    duration: 100,
  });
  assert.strictEqual(noClient.status, 400);
});

test('focus session: unauthorized without a token', async () => {
  const res = await fetch(`${base}/api/focus-sessions`, { method: 'POST' });
  assert.strictEqual(res.status, 401);
});

// ---------------------------------------------------------------------------
// GET /api/focus-sessions/stats — deterministic buckets via frozen clock
// Frozen now: Wednesday 2026-08-12 10:00 WIB (week starts Monday Aug 10,
// month is August 2026).
// ---------------------------------------------------------------------------
test('focus stats: today / this week / this month are computed server-side', async () => {
  await withFrozenNow('2026-08-12T10:00:00+07:00', async () => {
    resetFocus();
    // A: today (Wed Aug 12 09:00) → today + week + month
    seedFocus({ user: USER_A, clientId: 'a', startTime: '2026-08-12T09:00:00+07:00', duration: 1800 });
    // B: this week, not today (Tue Aug 11 09:00) → week + month
    seedFocus({ user: USER_A, clientId: 'b', startTime: '2026-08-11T09:00:00+07:00', duration: 1200 });
    // C: earlier this month, outside this week (Wed Aug 5 09:00) → month only
    seedFocus({ user: USER_A, clientId: 'c', startTime: '2026-08-05T09:00:00+07:00', duration: 900 });
    // D: previous month (Tue Jul 28 09:00) → none of the buckets
    seedFocus({ user: USER_A, clientId: 'd', startTime: '2026-07-28T09:00:00+07:00', duration: 600 });

    const res = await get('/api/focus-sessions/stats');
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.deepStrictEqual(json.today, { count: 1, duration: 1800 });
    assert.deepStrictEqual(json.week, { count: 2, duration: 3000 });
    assert.deepStrictEqual(json.month, { count: 3, duration: 3900 });
  });
});

// ---------------------------------------------------------------------------
// User isolation
// ---------------------------------------------------------------------------
test('focus sessions: users cannot see or affect each other', async () => {
  await withFrozenNow('2026-08-12T10:00:00+07:00', async () => {
    resetFocus();
    seedFocus({ user: USER_A, clientId: 'only-a', startTime: '2026-08-12T09:00:00+07:00', duration: 1500 });

    // User B's list is empty even though A has sessions.
    const bList = await (await get('/api/focus-sessions', USER_B)).json();
    assert.strictEqual(bList.length, 0);
    // User B's stats are zero.
    const bStats = await (await get('/api/focus-sessions/stats', USER_B)).json();
    assert.strictEqual(bStats.today.duration, 0);
    assert.strictEqual(bStats.week.duration, 0);
    assert.strictEqual(bStats.month.duration, 0);
    // User A still sees their own session.
    const aList = await (await get('/api/focus-sessions')).json();
    assert.strictEqual(aList.length, 1);

    // B creating a session does not change A's totals.
    await post(
      '/api/focus-sessions',
      {
        clientId: 'b-1',
        startTime: new Date(Date.now() - 300 * 1000).toISOString(),
        endTime: new Date().toISOString(),
        duration: 300,
        status: 'completed',
      },
      USER_B
    );
    const aStats = await (await get('/api/focus-sessions/stats')).json();
    assert.strictEqual(aStats.today.count, 1);
  });
});

// ---------------------------------------------------------------------------
// Weekly + monthly review include focus time
// ---------------------------------------------------------------------------
test('weekly review: focus block is backend-computed for the reviewed week', async () => {
  await withFrozenNow('2026-08-12T10:00:00+07:00', async () => {
    resetFocus();
    seedFocus({ user: USER_A, clientId: 'w1', startTime: '2026-08-11T09:00:00+07:00', duration: 1200 }); // in week
    seedFocus({ user: USER_A, clientId: 'w2', startTime: '2026-08-05T09:00:00+07:00', duration: 900 }); // outside week
    behavior.taskCount = 3;

    const res = await get('/api/weekly-review');
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.deepStrictEqual(json.focus, { count: 1, duration: 1200 });
  });
});

test('monthly review: focus block covers the whole month', async () => {
  await withFrozenNow('2026-08-12T10:00:00+07:00', async () => {
    resetFocus();
    seedFocus({ user: USER_A, clientId: 'm1', startTime: '2026-08-11T09:00:00+07:00', duration: 1200 });
    seedFocus({ user: USER_A, clientId: 'm2', startTime: '2026-08-05T09:00:00+07:00', duration: 900 });
    seedFocus({ user: USER_A, clientId: 'm3', startTime: '2026-07-28T09:00:00+07:00', duration: 600 }); // July

    const res = await get('/api/monthly-review');
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.deepStrictEqual(json.focus, { count: 2, duration: 2100 });
  });
});

test('monthly review AI summary embeds focus minutes from backend data', async () => {
  await withFrozenNow('2026-08-12T10:00:00+07:00', async () => {
    resetFocus();
    seedFocus({ user: USER_A, clientId: 'm1', startTime: '2026-08-11T09:00:00+07:00', duration: 2700 }); // 45 min
    gemini.lastPrompt = '';
    const res = await post('/api/monthly-review/ai-summary', {});
    assert.strictEqual(res.status, 200);
    assert.ok(gemini.lastPrompt.includes('FOCUS TIME'));
    assert.ok(gemini.lastPrompt.includes('45 minutes'), 'prompt should contain backend focus minutes');
  });
});

// ---------------------------------------------------------------------------
// AI focus context + response structure
// ---------------------------------------------------------------------------
test('AI focus context: reports today/week/month focus from recorded sessions', async () => {
  await withFrozenNow('2026-08-12T10:00:00+07:00', async () => {
    resetFocus();
    seedFocus({ user: USER_A, clientId: 'a1', startTime: '2026-08-12T09:00:00+07:00', duration: 3600 }); // 1h today
    seedFocus({ user: USER_A, clientId: 'a2', startTime: '2026-08-11T09:00:00+07:00', duration: 1500 });
    const ctx = await buildFocusContext(USER_A);
    assert.ok(ctx.includes('Focus time'));
    assert.ok(ctx.includes('Today: 1h 0m'));
    assert.ok(ctx.includes('This week: 1h 25m'));
    assert.ok(ctx.includes('This month: 1h 25m'));
  });
});

test('AI financial insight prompt uses FACTS / INSIGHTS / RECOMMENDATIONS sections', async () => {
  resetFocus();
  gemini.lastPrompt = '';
  const res = await post('/api/ai/financial-insight', {});
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(gemini.lastPrompt.includes('**FACTS**'));
  assert.ok(gemini.lastPrompt.includes('**INSIGHTS**'));
  assert.ok(gemini.lastPrompt.includes('**RECOMMENDATIONS**'));
  // The authoritative figures must be embedded verbatim, never computed by the model.
  assert.ok(gemini.lastPrompt.includes('SYSTEM-CALCULATED FIGURES'));
});
