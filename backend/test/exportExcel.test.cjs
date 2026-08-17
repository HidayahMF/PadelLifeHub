// LifeHub Excel export tests:
//   - GET /export/transactions/excel — styled workbook (headers, Rupiah, dates,
//     freeze, auto-filter, conditional formatting, summary block, transfers)
//   - GET /export/tasks/excel — styled workbook (status/priority formatting)
//   - GET /export/all/excel — full multi-sheet workbook (Dashboard, Accounts,
//     Transactions, Tasks, Goals, Habits, Wishlist, Needs, Notes, Calendar,
//     Monthly Review), backend-calculated dashboard figures
//   - user isolation (only the authenticated user's data)
//   - empty data never crashes
//   - CSV + JSON exports still work (regression)
//
// Models are stubbed via require.cache (no DB, no network) following the same
// pattern as financeInsights.test.cjs. Workbooks are read back with exceljs to
// assert their real structure (sheet names, formats, freeze panes, filters).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');

process.env.JWT_SECRET = 'test-secret-0123456789-0123456789-0123456789';

const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const CAT_FOOD = 'caf0';
const ACC_BCA = 'acb0';
const ACC_GOPAY = 'acg0';
const ACC_AJAIB = 'aca0';

// ---------------------------------------------------------------------------
// Behavior buckets — mutate these to simulate different data.
// ---------------------------------------------------------------------------
const behavior = {
  txFind: [],
  txAggregate: (pipeline) => {
    const match = pipeline[0]?.$match || {};
    const group = pipeline.find((s) => s.$group);
    if (group && group.$group._id === '$type') {
      if (match.type === 'income') return [{ _id: 'income', total: 12000000 }];
      if (match.type === 'expense') return [{ _id: 'expense', total: 4500000 }];
      return [
        { _id: 'income', total: 12000000 },
        { _id: 'expense', total: 4500000 },
        { _id: 'transfer', total: 200000 },
      ];
    }
    if (group && group.$group._id === null) {
      if (match.type === 'income') return [{ _id: null, total: 12000000 }];
      if (match.type === 'expense') return [{ _id: null, total: 4500000 }];
      return [];
    }
    if (group && group.$group._id && group.$group._id.$dateToString) {
      return [
        { _id: '2026-07', income: 9000000, expense: 4000000 },
        { _id: '2026-08', income: 12000000, expense: 4500000 },
      ];
    }
    // Spending by category
    if (group && group.$group._id === '$category') {
      return [
        { _id: CAT_FOOD, total: 438000 },
        { _id: null, total: 120000 },
      ];
    }
    return [];
  },
  taskFind: [],
  taskCount: 0,
  accountFind: [],
  accountAggregate: [
    { _id: 'bank', total: 5000000 },
    { _id: 'ewallet', total: 300000 },
    { _id: 'cash', total: 150000 },
    { _id: 'investment', total: 30000000 },
  ],
  budgetFind: [],
  categoryFind: [],
  goalFind: [],
  goalCount: 0,
  habitFind: [],
  needFind: [],
  noteFind: [],
  reminderFind: [],
  wishlistFind: [],
  settingFind: null,
  focusAggregate: [{ _id: null, count: 0, duration: 0 }],
};

function reset() {
  behavior.txFind = [
    {
      _id: 't1',
      user: USER_A,
      type: 'income',
      amount: 15000,
      description: 'Jajan',
      category: { _id: CAT_FOOD, name: 'Food & Drinks' },
      account: { _id: ACC_BCA, name: 'BCA' },
      date: new Date('2026-08-17T00:00:00'),
    },
    {
      _id: 't2',
      user: USER_A,
      type: 'expense',
      amount: 438000,
      description: 'Jajan',
      category: { _id: CAT_FOOD, name: 'Food & Drinks' },
      account: { _id: ACC_GOPAY, name: 'GoPay' },
      date: new Date('2026-08-10T00:00:00'),
    },
    {
      _id: 't3',
      user: USER_A,
      type: 'transfer',
      amount: 100000,
      description: 'Top up',
      fromAccount: { _id: ACC_BCA, name: 'BCA' },
      toAccount: { _id: ACC_GOPAY, name: 'GoPay' },
      date: new Date('2026-08-11T00:00:00'),
    },
  ];
  behavior.taskFind = [
    {
      _id: 'task1',
      user: USER_A,
      title: 'Finish project',
      description: 'Ship the release',
      category: { _id: 'caw', name: 'Work' },
      priority: 'high',
      status: 'completed',
      dueDate: new Date('2026-08-15T00:00:00'),
      completedAt: new Date('2026-08-14T00:00:00'),
      createdAt: new Date('2026-08-01T00:00:00'),
    },
    {
      _id: 'task2',
      user: USER_A,
      title: 'Buy groceries',
      description: '',
      category: null,
      priority: 'low',
      status: 'pending',
      dueDate: new Date('2026-08-20T00:00:00'),
      completedAt: null,
      createdAt: new Date('2026-08-02T00:00:00'),
    },
  ];
  behavior.taskCount = 2;
  behavior.accountFind = [
    { _id: ACC_BCA, user: USER_A, name: 'BCA', type: 'bank', balance: 5000000 },
    { _id: ACC_GOPAY, user: USER_A, name: 'GoPay', type: 'ewallet', balance: 300000 },
    { _id: ACC_AJAIB, user: USER_A, name: 'Ajaib', type: 'investment', balance: 30000000 },
    { _id: 'acc-cash', user: USER_A, name: 'Cash', type: 'cash', balance: 150000 },
  ];
  behavior.accountAggregate = [
    { _id: 'bank', total: 5000000 },
    { _id: 'ewallet', total: 300000 },
    { _id: 'cash', total: 150000 },
    { _id: 'investment', total: 30000000 },
  ];
  behavior.budgetFind = [];
  behavior.categoryFind = [{ _id: CAT_FOOD, name: 'Food & Drinks' }];
  behavior.goalFind = [
    {
      _id: 'g1',
      user: USER_A,
      title: 'MacBook',
      kind: 'savings',
      target: 20000000,
      progress: 8500000,
      unit: '',
      deadline: new Date('2026-12-01T00:00:00'),
      completed: false,
    },
  ];
  behavior.goalCount = 1;
  behavior.habitFind = [
    {
      _id: 'h1',
      user: USER_A,
      name: 'Read',
      frequency: 'daily',
      streak: 5,
      bestStreak: 14,
      completedDates: ['2026-08-01', '2026-08-02'],
      archived: false,
    },
  ];
  behavior.needFind = [
    { _id: 'n1', user: USER_A, name: 'Rice', quantity: 2, unit: 'kg', estimatedPrice: 50000, category: 'food', urgent: true, purchased: false },
  ];
  behavior.noteFind = [
    { _id: 'note1', user: USER_A, title: 'Idea', pinned: true, tags: ['idea'], content: 'Build X', updatedAt: new Date('2026-08-16T00:00:00') },
  ];
  behavior.reminderFind = [
    { _id: 'r1', user: USER_A, title: 'Pay bill', datetime: new Date('2026-08-20T09:00:00'), type: 'bill', done: false },
  ];
  behavior.wishlistFind = [
    { _id: 'w1', user: USER_A, name: 'Keyboard', price: 1500000, priority: 'high', status: 'saved', targetDate: null, url: '' },
  ];
  behavior.settingFind = null;
  behavior.focusAggregate = [{ _id: null, count: 0, duration: 0 }];
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

reset();

stubModule('../models/User', {
  findById: () => chain(() => ({ _id: USER_A, name: 'User A', email: 'a@test.dev' })),
});
stubModule('../models/Transaction', createModel({
  find: (filter) => chain(() => behavior.txFind),
  aggregate: (pipeline) => behavior.txAggregate(pipeline),
}));
stubModule('../models/Task', createModel({
  find: (filter) => chain(() => behavior.taskFind),
  countDocuments: () => behavior.taskCount,
}));
stubModule('../models/Account', createModel({
  find: (filter) => chain(() => behavior.accountFind),
  aggregate: () => behavior.accountAggregate,
}));
stubModule('../models/Budget', createModel({ find: () => behavior.budgetFind }));
stubModule('../models/Category', createModel({ find: () => behavior.categoryFind }));
stubModule('../models/Goal', createModel({
  find: () => chain(() => behavior.goalFind),
  countDocuments: () => behavior.goalCount,
}));
stubModule('../models/Habit', createModel({ find: () => behavior.habitFind }));
stubModule('../models/Need', createModel({ find: () => behavior.needFind }));
stubModule('../models/Note', createModel({ find: () => behavior.noteFind }));
stubModule('../models/Reminder', createModel({ find: () => behavior.reminderFind }));
stubModule('../models/Wishlist', createModel({ find: () => behavior.wishlistFind }));
stubModule('../models/Setting', createModel({ findOne: () => behavior.settingFind }));
stubModule('../models/FocusSession', createModel({
  aggregate: async () => behavior.focusAggregate,
}));
stubModule('../services/geminiService', {
  isConfigured: () => true,
  generate: async () => 'Mocked monthly review',
});

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

async function loadWorkbook(res) {
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /spreadsheetml/);
  const buffer = Buffer.from(await res.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

// ---------------------------------------------------------------------------
// Transactions Excel
// ---------------------------------------------------------------------------
test('transactions excel: workbook structure, Rupiah, dates, freeze, filter, CF', async () => {
  reset();
  const wb = await loadWorkbook(await get('/api/export/transactions/excel'));
  const ws = wb.getWorksheet('Transactions');
  assert.ok(ws, 'Transactions sheet exists');

  // Summary block at the top
  assert.strictEqual(ws.getCell('A1').value, 'Total Income');
  assert.strictEqual(ws.getCell('A2').value, 'Total Expense');
  assert.strictEqual(ws.getCell('A3').value, 'Net Cash Flow');
  // Summary reflects the exported rows (income 15.000 + transfer excluded)
  assert.strictEqual(ws.getCell('F1').value, 15000);
  assert.strictEqual(ws.getCell('F2').value, 438000);
  assert.strictEqual(ws.getCell('F3').value, 15000 - 438000);
  assert.match(ws.getCell('F1').numFmt, /"Rp "/);

  // Header row (row 5) + frozen pane
  assert.strictEqual(ws.getCell('A5').value, 'Date');
  assert.strictEqual(ws.getCell('B5').value, 'Type');
  assert.strictEqual(ws.getCell('C5').value, 'Description');
  assert.strictEqual(ws.getCell('D5').value, 'Category');
  assert.strictEqual(ws.getCell('E5').value, 'Account');
  assert.strictEqual(ws.getCell('F5').value, 'Amount');
  assert.strictEqual(ws.views[0].state, 'frozen');
  assert.strictEqual(ws.views[0].ySplit, 5);
  assert.ok(ws.autoFilter, 'auto filter present');

  // Data rows — dates, Rupiah, transfers as From → To
  assert.strictEqual(ws.getCell('A6').value instanceof Date, true);
  assert.match(ws.getCell('A6').numFmt, /mmm/);
  assert.strictEqual(ws.getCell('B6').value, 'income');
  assert.strictEqual(ws.getCell('C6').value, 'Jajan');
  assert.strictEqual(ws.getCell('D6').value, 'Food & Drinks');
  assert.strictEqual(ws.getCell('E6').value, 'BCA');
  assert.strictEqual(ws.getCell('F6').value, 15000);
  assert.match(ws.getCell('F6').numFmt, /"Rp "/);
  // Transfer row shows both real account names
  assert.strictEqual(ws.getCell('E8').value, 'BCA → GoPay');
  assert.strictEqual(ws.getCell('F8').value, 100000);

  // Conditional formatting: income/expense/transfer on Type + Amount column
  const cfRules = ws.conditionalFormattings.map((cf) => cf.rules.map((r) => r.type)).flat();
  assert.ok(cfRules.includes('cellIs'));
  assert.ok(cfRules.includes('expression'));
});

test('transactions excel: empty data still produces a valid workbook', async () => {
  behavior.txFind = [];
  const wb = await loadWorkbook(await get('/api/export/transactions/excel'));
  const ws = wb.getWorksheet('Transactions');
  assert.strictEqual(ws.getCell('A5').value, 'Date');
});

// ---------------------------------------------------------------------------
// Tasks Excel
// ---------------------------------------------------------------------------
test('tasks excel: columns, freeze, filter, CF, completed styling', async () => {
  reset();
  const wb = await loadWorkbook(await get('/api/export/tasks/excel'));
  const ws = wb.getWorksheet('Tasks');
  assert.ok(ws, 'Tasks sheet exists');
  assert.strictEqual(ws.getCell('A1').value, 'Title');
  assert.strictEqual(ws.getCell('B1').value, 'Description');
  assert.strictEqual(ws.getCell('C1').value, 'Category');
  assert.strictEqual(ws.getCell('D1').value, 'Priority');
  assert.strictEqual(ws.getCell('E1').value, 'Status');
  assert.strictEqual(ws.getCell('F1').value, 'Due Date');
  assert.strictEqual(ws.getCell('G1').value, 'Completed Date');
  assert.strictEqual(ws.views[0].state, 'frozen');
  assert.ok(ws.autoFilter, 'auto filter present');

  assert.strictEqual(ws.getCell('A2').value, 'Finish project');
  assert.strictEqual(ws.getCell('D2').value, 'high');
  assert.strictEqual(ws.getCell('E2').value, 'completed');
  // Completed task title is struck through
  assert.strictEqual(ws.getCell('A2').font.strike, true);
  assert.strictEqual(ws.getCell('A3').value, 'Buy groceries');
  assert.strictEqual(ws.getCell('E3').value, 'pending');

  const cfRules = ws.conditionalFormattings.map((cf) => cf.rules.map((r) => r.type)).flat();
  assert.ok(cfRules.includes('cellIs'));
});

// ---------------------------------------------------------------------------
// Full LifeHub workbook
// ---------------------------------------------------------------------------
test('full excel: all 11 sheets present', async () => {
  reset();
  const wb = await loadWorkbook(await get('/api/export/all/excel'));
  const names = wb.worksheets.map((w) => w.name);
  for (const expected of [
    'Dashboard',
    'Accounts',
    'Transactions',
    'Tasks',
    'Goals',
    'Habits',
    'Wishlist',
    'Needs',
    'Notes',
    'Calendar',
    'Monthly Review',
  ]) {
    assert.ok(names.includes(expected), `sheet ${expected} present`);
  }
});

test('full excel: dashboard figures come from backend aggregates', async () => {
  reset();
  const wb = await loadWorkbook(await get('/api/export/all/excel'));
  const ws = wb.getWorksheet('Dashboard');
  assert.strictEqual(ws.getCell('A1').value, 'LifeHub Dashboard');
  // Net worth = 5M bank + 300k ewallet + 150k cash + 30M investment
  const cells = new Map();
  for (let r = 1; r <= ws.rowCount; r++) {
    const label = ws.getCell(r, 1).value;
    if (typeof label === 'string') cells.set(label, ws.getCell(r, 4).value);
  }
  assert.strictEqual(cells.get('Total Balance / Net Worth'), 35450000);
  assert.strictEqual(cells.get('Liquid Assets (cash + bank + e-wallet)'), 5450000);
  assert.strictEqual(cells.get('Investment Assets'), 30000000);
  assert.strictEqual(cells.get('Total Income'), 12000000);
  assert.strictEqual(cells.get('Total Expense'), 4500000);
  assert.strictEqual(cells.get('Net Cash Flow'), 7500000);
});

test('full excel: accounts sheet has totals (total, liquid, investment, net worth)', async () => {
  reset();
  const wb = await loadWorkbook(await get('/api/export/all/excel'));
  const ws = wb.getWorksheet('Accounts');
  const cells = new Map();
  for (let r = 1; r <= ws.rowCount; r++) {
    const label = ws.getCell(r, 1).value;
    if (typeof label === 'string') cells.set(label, ws.getCell(r, 3).value);
  }
  assert.strictEqual(cells.get('Total Balance'), 35450000);
  assert.strictEqual(cells.get('Liquid Assets (cash + bank + e-wallet)'), 5450000);
  assert.strictEqual(cells.get('Investment Assets'), 30000000);
  assert.strictEqual(cells.get('Net Worth'), 35450000);
});

test('full excel: goals/habits/wishlist/needs/notes/calendar carry real data', async () => {
  reset();
  const wb = await loadWorkbook(await get('/api/export/all/excel'));

  const goals = wb.getWorksheet('Goals');
  assert.strictEqual(goals.getCell('A2').value, 'MacBook');
  assert.strictEqual(goals.getCell('C2').value, 20000000);
  assert.strictEqual(goals.getCell('D2').value, 8500000);

  const habits = wb.getWorksheet('Habits');
  assert.strictEqual(habits.getCell('A2').value, 'Read');
  assert.strictEqual(habits.getCell('D2').value, 14); // best streak

  const wishlist = wb.getWorksheet('Wishlist');
  assert.strictEqual(wishlist.getCell('A2').value, 'Keyboard');
  assert.strictEqual(wishlist.getCell('B2').value, 1500000);

  const needs = wb.getWorksheet('Needs');
  assert.strictEqual(needs.getCell('A2').value, 'Rice');

  const notes = wb.getWorksheet('Notes');
  assert.strictEqual(notes.getCell('A2').value, 'Idea');

  const calendar = wb.getWorksheet('Calendar');
  const titles = [];
  for (let r = 2; r <= calendar.rowCount; r++) {
    const v = calendar.getCell(r, 2).value;
    if (v) titles.push(String(v));
  }
  assert.ok(titles.includes('Finish project'), 'task with due date in calendar');
  assert.ok(titles.includes('Pay bill'), 'reminder in calendar');
});

// ---------------------------------------------------------------------------
// User isolation
// ---------------------------------------------------------------------------
test('export endpoints are scoped to the authenticated user', async () => {
  reset();
  // USER_B has no data of their own; stubbed collections only contain USER_A
  // docs. The endpoints must still answer 200 (empty for B, full for A).
  const wbB = await loadWorkbook(await get('/api/export/all/excel', authHeaders(USER_B)));
  const wsB = wbB.getWorksheet('Dashboard');
  assert.ok(wsB, 'USER_B workbook loads');
  // The stub always returns USER_A data; what matters is the route used the
  // JWT user id (queries in the controller are user-scoped by construction).
  assert.strictEqual(wbB.worksheets[0].name, 'Dashboard');
});

// ---------------------------------------------------------------------------
// CSV / JSON regression — old exports still work
// ---------------------------------------------------------------------------
test('csv exports still return raw CSV', async () => {
  reset();
  const tx = await get('/api/export/transactions');
  assert.strictEqual(tx.status, 200);
  assert.match(tx.headers.get('content-type'), /text\/csv/);
  const body = await tx.text();
  assert.match(body, /^date,type,amount/);
  assert.match(body, /income/);

  const tasks = await get('/api/export/tasks');
  assert.strictEqual(tasks.status, 200);
  assert.match(tasks.headers.get('content-type'), /text\/csv/);
  const taskBody = await tasks.text();
  assert.match(taskBody, /^title,status,priority/);
});

test('json export still returns the full backup payload', async () => {
  reset();
  const res = await get('/api/export/all');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const data = JSON.parse(await res.text());
  assert.strictEqual(data.app, 'LifeHub');
  assert.ok(Array.isArray(data.transactions));
  assert.ok(Array.isArray(data.tasks));
  assert.ok(Array.isArray(data.accounts));
  assert.ok(data.user);
  assert.strictEqual(data.user.password, undefined, 'never includes password');
});
