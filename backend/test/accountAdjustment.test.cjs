// LifeHub balance-adjustment tests:
//   - POST /api/accounts/:id/adjustments — add / reduce / reject bad input /
//     ownership / no-op / concurrency conflict / immutable append-only history
//   - GET  /api/accounts/:id/adjustments — newest-first, paginated, user-scoped
//   - PUT  /api/accounts/:id — metadata only; balance can never be overwritten
//
// Models are stubbed via require.cache (no DB). A conditional findOneAndUpdate
// guards the balance write, so a "concurrent" transaction that lands between
// the read and the write causes a 409 with a rolled-back history row.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-0123456789-0123456789-0123456789';

const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbb';
const ACC_BANK = '555555555555555555555555'; // Bank BCA — USER_A
const ACC_FOREIGN = '666666666666666666666666'; // USER_B's account

const behavior = {
  accounts: [],
  adjustments: [],
  updateCalls: [],
  /** When set, the updateOne stub mutates the balance just before the comparison —
   *  simulating a transaction landing between the controller's read and write. */
  sneakBalance: null,
};

/** Reset in-memory "database". */
function reset() {
  behavior.accounts = [
    {
      _id: ACC_BANK,
      user: USER_A,
      name: 'BCA',
      type: 'bank',
      balance: 150000,
      currency: 'IDR',
      save: async function () {
        return this;
      },
    },
    {
      _id: ACC_FOREIGN,
      user: USER_B,
      name: "B's BCA",
      type: 'bank',
      balance: 5000000,
      currency: 'IDR',
      save: async function () {
        return this;
      },
    },
  ];
  behavior.adjustments = [];
  behavior.updateCalls = [];
  behavior.sneakBalance = null;
}

function findBy(filters) {
  return behavior.accounts.find(
    (a) =>
      (!filters._id || String(a._id) === String(filters._id)) &&
      (!filters.user || String(a.user) === String(filters.user))
  );
}

function chain(getDocs) {
  const q = {
    sort() { return q; },
    skip() { return q; },
    limit() { return q; },
    populate() { return q; },
    select() { return q; },
    lean() { return q; },
    then(resolve) { resolve(getDocs()); },
  };
  return q;
}

/** Query builder that actually applies skip/limit before resolving. */
function pagedChain(getDocs) {
  let skip = 0;
  let limit;
  const q = {
    sort() { return q; },
    skip(n) { skip = n || 0; return q; },
    limit(n) { limit = n; return q; },
    populate() { return q; },
    select() { return q; },
    lean() { return q; },
    then(resolve) {
      let docs = getDocs();
      if (limit !== undefined) docs = docs.slice(skip, skip + limit);
      resolve(docs);
    },
  };
  return q;
}

function createModel({ findOne, exists, updateOne, findById, aggregate }) {
  return {
    find: (filter) => pagedChain(() =>
      [...behavior.adjustments]
        .filter(
          (x) =>
            (!filter?.account || String(x.account) === String(filter.account)) &&
            (!filter?.user || String(x.user) === String(filter.user))
        )
        .sort((a, b) => new Date(b.adjustmentDate) - new Date(a.adjustmentDate))
    ),
    findOne: async (filter) => (findOne ? findOne(filter) : null),
    findById: async (id) => (findById ? findById(id) : findBy({ _id: id }) ?? null),
    exists: async (filter) => (exists ? exists(filter) : false),
    updateOne: async (filter, update) => (updateOne ? updateOne(filter, update) : { matchedCount: 0 }),
    aggregate: aggregate || (async () => []),
    countDocuments: async (filter) =>
      behavior.adjustments.filter((x) => !filter?.account || String(x.account) === String(filter.account))
        .length,
    create: async (doc) => {
      const row = {
        _id: `adj-${behavior.adjustments.length + 1}`,
        adjustmentDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...doc,
      };
      behavior.adjustments.push(row);
      return row;
    },
    deleteOne: async (filter) => {
      behavior.adjustments = behavior.adjustments.filter((x) => String(x._id) !== String(filter._id));
      return { deletedCount: 1 };
    },
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

stubModule('../models/Account', createModel({
  findOne: async (filter) => findBy(filter) ?? null,
  exists: async (filter) => !!findBy(filter),
  updateOne: async (filter, update) => {
    behavior.updateCalls.push({ filter, update });
    const target = findBy(filter);
    if (!target) return { matchedCount: 0, modifiedCount: 0 };
    // Simulate a transaction landing between the controller's read and write.
    if (behavior.sneakBalance !== null) target.balance = behavior.sneakBalance;
    const sameBalance = Number(target.balance) === filter.balance;
    if (!sameBalance) return { matchedCount: 0, modifiedCount: 0 };
    target.balance = update.$set.balance;
    return { matchedCount: 1, modifiedCount: 1 };
  },
  findById: async (id) => findBy({ _id: id }) ?? null,
  aggregate: async () => [],
}));

stubModule('../models/AccountBalanceAdjustment', createModel({}));

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

after(() => server?.close());

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
const authHeaders = (id = USER_A) => ({ Authorization: `Bearer ${tokenFor(id)}` });

function call(method, path, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const post = (path, body, headers = {}) => call('POST', path, body, headers);
const put = (path, body, headers = {}) => call('PUT', path, body, headers);
const get = (path, headers = {}) =>
  fetch(`${base}${path}`, { headers: { ...authHeaders(), ...headers } });

// ---------------------------------------------------------------------------
// POST /api/accounts/:id/adjustments
// ---------------------------------------------------------------------------
test('adjustment: adds balance and records append-only history', async () => {
  reset();
  const res = await post(`/api/accounts/${ACC_BANK}/adjustments`, {
    newBalance: 200000,
    reason: 'Koreksi saldo sesuai aplikasi',
  });
  assert.strictEqual(res.status, 201);
  const json = await res.json();
  assert.strictEqual(json.account.balance, 200000);
  assert.strictEqual(json.adjustment.previousBalance, 150000);
  assert.strictEqual(json.adjustment.newBalance, 200000);
  assert.strictEqual(json.adjustment.difference, 50000);
  assert.strictEqual(json.adjustment.reason, 'Koreksi saldo sesuai aplikasi');
  assert.strictEqual(json.adjustment.currency, 'IDR');
  assert.strictEqual(behavior.adjustments.length, 1);
  assert.strictEqual(behavior.accounts.find((a) => a._id === ACC_BANK).balance, 200000);
});

test('adjustment: reduces balance with a negative difference', async () => {
  reset();
  const res = await post(`/api/accounts/${ACC_BANK}/adjustments`, {
    newBalance: 100000,
    reason: 'Uang hilang dari e-wallet',
  });
  assert.strictEqual(res.status, 201);
  const json = await res.json();
  assert.strictEqual(json.adjustment.previousBalance, 150000);
  assert.strictEqual(json.adjustment.difference, -50000);
  assert.strictEqual(behavior.accounts.find((a) => a._id === ACC_BANK).balance, 100000);
});

test('adjustment: no-op when the balance is already the requested value', async () => {
  reset();
  const res = await post(`/api/accounts/${ACC_BANK}/adjustments`, {
    newBalance: 150000,
    reason: 'Tidak ada perubahan',
  });
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.match(json.message, /already the requested value/i);
  assert.strictEqual(behavior.adjustments.length, 0);
  assert.strictEqual(behavior.accounts.find((a) => a._id === ACC_BANK).balance, 150000);
});

test('adjustment: rejects an empty reason', async () => {
  reset();
  const res = await post(`/api/accounts/${ACC_BANK}/adjustments`, {
    newBalance: 200000,
    reason: '   ',
  });
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.match(json.message, /reason/i);
  assert.strictEqual(behavior.adjustments.length, 0);
  assert.strictEqual(behavior.accounts.find((a) => a._id === ACC_BANK).balance, 150000);
});

test('adjustment: rejects a negative newBalance', async () => {
  reset();
  const res = await post(`/api/accounts/${ACC_BANK}/adjustments`, {
    newBalance: -5,
    reason: 'Harus positif',
  });
  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).message, /negative/i);
  assert.strictEqual(behavior.adjustments.length, 0);
});

test('adjustment: rejects a non-numeric newBalance', async () => {
  reset();
  const res = await post(`/api/accounts/${ACC_BANK}/adjustments`, {
    newBalance: 'abc',
    reason: 'Angka',
  });
  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).message, /valid number/i);
  assert.strictEqual(behavior.adjustments.length, 0);
});

test('adjustment: rejects changes to another user\'s account', async () => {
  reset();
  const res = await post(`/api/accounts/${ACC_FOREIGN}/adjustments`, {
    newBalance: 100,
    reason: 'Mau menipu',
  });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(behavior.adjustments.length, 0);
  assert.strictEqual(behavior.accounts.find((a) => a._id === ACC_FOREIGN).balance, 5000000);
});

test('adjustment: 409 on concurrent balance change, history fully rolled back', async () => {
  reset();
  // Simulate an income transaction that lands AFTER the controller's fresh
  // read of the account (balance 150k) but BEFORE its conditional write.
  behavior.sneakBalance = 180000;
  const res = await post(`/api/accounts/${ACC_BANK}/adjustments`, {
    newBalance: 200000,
    reason: 'Sementara ada transfer masuk',
  });
  assert.strictEqual(res.status, 409);
  const json = await res.json();
  assert.match(json.message, /concurrently/i);
  // No partial state: no orphan history, balance stays at the concurrent value.
  assert.strictEqual(behavior.adjustments.length, 0);
  assert.strictEqual(behavior.accounts.find((a) => a._id === ACC_BANK).balance, 180000);
});

test('adjustment: unauthorized without a token', async () => {
  reset();
  const res = await fetch(`${base}/api/accounts/${ACC_BANK}/adjustments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newBalance: 200000, reason: 'x' }),
  });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(behavior.adjustments.length, 0);
});

// ---------------------------------------------------------------------------
// GET /api/accounts/:id/adjustments
// ---------------------------------------------------------------------------
test('history: returns newest-first, paginated, user-scoped', async () => {
  reset();
  // Seed three records for USER_A's BCA account.
  behavior.adjustments = [
    { _id: 'a1', user: USER_A, account: ACC_BANK, previousBalance: 100000, newBalance: 150000, difference: 50000, reason: 'Koreksi 1', currency: 'IDR', adjustmentDate: new Date('2026-08-01T08:00:00Z') },
    { _id: 'a2', user: USER_A, account: ACC_BANK, previousBalance: 150000, newBalance: 200000, difference: 50000, reason: 'Koreksi 2', currency: 'IDR', adjustmentDate: new Date('2026-08-05T08:00:00Z') },
    { _id: 'a3', user: USER_A, account: ACC_BANK, previousBalance: 200000, newBalance: 180000, difference: -20000, reason: 'Koreksi 3', currency: 'IDR', adjustmentDate: new Date('2026-08-10T08:00:00Z') },
  ];

  const res = await get(`/api/accounts/${ACC_BANK}/adjustments?page=1&limit=2`);
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.total, 3);
  assert.strictEqual(json.page, 1);
  assert.strictEqual(json.limit, 2);
  assert.strictEqual(json.hasMore, true);
  assert.deepStrictEqual(
    json.adjustments.map((a) => a._id),
    ['a3', 'a2']
  );

  const page2 = await (await get(`/api/accounts/${ACC_BANK}/adjustments?page=2&limit=2`)).json();
  assert.deepStrictEqual(page2.adjustments.map((a) => a._id), ['a1']);
  assert.strictEqual(page2.hasMore, false);
});

test('history: never leaks another user\'s account or records', async () => {
  reset();
  const res = await get(`/api/accounts/${ACC_FOREIGN}/adjustments`);
  assert.strictEqual(res.status, 404); // ownership guard, no account probing
});

test('history: empty for an account with no adjustments', async () => {
  reset();
  const res = await get(`/api/accounts/${ACC_BANK}/adjustments`);
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.total, 0);
  assert.deepStrictEqual(json.adjustments, []);
});

// ---------------------------------------------------------------------------
// PUT /api/accounts/:id — metadata only
// ---------------------------------------------------------------------------
test('update account: metadata edits allowed, balance overwrite is stripped', async () => {
  reset();
  const res = await put(`/api/accounts/${ACC_BANK}`, {
    name: 'BCA Utama',
    type: 'bank',
    balance: 999999999, // must be ignored
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.name, 'BCA Utama');
  assert.strictEqual(json.type, 'bank');
  assert.strictEqual(json.balance, 150000); // untouched — no silent overwrite
  assert.strictEqual(behavior.adjustments.length, 0);
});

test('update account: cannot move an account to another user', async () => {
  reset();
  const res = await put(`/api/accounts/${ACC_BANK}`, {
    name: 'BCA',
    user: USER_B,
    balance: 1,
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.user, USER_A);
  assert.strictEqual(json.balance, 150000);
  assert.strictEqual(behavior.accounts.find((a) => a._id === ACC_BANK).user, USER_A);
});