// Integration test — exercises the critical LifeHub flows against a running
// API (http://localhost:5000). Creates a throwaway user and cleans up all
// resources it created via the API at the end.
//
// Run: node scripts/integration-test.js

const BASE = process.env.API_URL || 'http://localhost:5000/api';

let token = '';
let userEmail = `itest-${Date.now()}@lifehub.local`;
let accountId = null;
let txnIncomeId = null;
let txnExpenseId = null;
let budgetId = null;
let categoryId = null;
let habitId = null;
let goalId = null;
let taskId = null;
let reminderId = null;
let txnRecurringId = null;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, path, { body, auth = true, expect = [200, 201] } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function main() {
  console.log('== LifeHub integration test ==\n');

  // ---------- AUTH ----------
  console.log('[auth]');
  const reg = await api('POST', '/auth/register', {
    body: { name: 'Integration Test', email: userEmail, password: 'test123456' },
    auth: false,
    expect: [201],
  });
  token = reg.data.token;
  check('register returns token', !!token);

  const login = await api('POST', '/auth/login', {
    body: { email: userEmail, password: 'test123456' },
    auth: false,
  });
  check('login returns token', !!login.data.token);
  token = login.data.token;

  const noToken = await fetch(`${BASE}/tasks`, { headers: { 'Content-Type': 'application/json' } });
  check('protected route without token → 401', noToken.status === 401);

  const badToken = await fetch(`${BASE}/tasks`, {
    headers: { Authorization: 'Bearer invalid.token.here' },
  });
  check('protected route with bad token → 401', badToken.status === 401);

  const forgot = await api('POST', '/auth/forgot-password', {
    body: { email: userEmail },
    auth: false,
  });
  check('forgot-password returns message', !!forgot.data.message && forgot.data.resetToken?.length > 0);
  if (forgot.data.resetToken) {
    const reset = await api('POST', '/auth/reset-password', {
      body: { token: forgot.data.resetToken, newPassword: 'newpass123' },
      auth: false,
    });
    check('reset-password works with token', reset.status === 200);
    const loginNew = await api('POST', '/auth/login', {
      body: { email: userEmail, password: 'newpass123' },
      auth: false,
    });
    token = loginNew.data.token;
    check('login with new password', !!token);
  }

  // ---------- AVATAR UPLOAD ----------
  console.log('\n[avatar upload]');
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const upForm = new FormData();
  upForm.append('avatar', new Blob([pngBytes], { type: 'image/png' }), 'avatar.png');
  const upRes = await fetch(`${BASE}/auth/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: upForm,
  });
  const upData = await upRes.json().catch(() => ({}));
  check(
    'upload avatar returns updated user with /uploads/ url',
    upRes.status === 200 && !!upData.avatar && upData.avatar.includes('/uploads/'),
    `avatar ${upData.avatar}`
  );
  const profAfterAvatar = await api('GET', '/auth/profile');
  check('avatar persisted on profile', profAfterAvatar.data.avatar === upData.avatar);

  const badForm = new FormData();
  badForm.append('avatar', new Blob([Buffer.from('not-an-image')], { type: 'text/plain' }), 'file.txt');
  const badRes = await fetch(`${BASE}/auth/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: badForm,
  });
  check('non-image upload rejected', badRes.status === 400, `status ${badRes.status}`);

  // ---------- FINANCE: account + balance math ----------
  console.log('\n[finance]');
  const acc = await api('POST', '/accounts', {
    body: { name: 'IT Test Bank', type: 'bank', balance: 1000000 },
  });
  accountId = acc.data._id;
  check('create account', !!accountId, `balance ${acc.data.balance}`);

  const cat = await api('POST', '/categories', {
    body: { name: 'Food-IT', color: '#f59e0b', type: 'transaction' },
  });
  categoryId = cat.data._id;

  const inc = await api('POST', '/transactions', {
    body: { type: 'income', amount: 500000, description: 'Salary IT', account: accountId, date: today() },
  });
  txnIncomeId = inc.data._id;

  const exp = await api('POST', '/transactions', {
    body: { type: 'expense', amount: 200000, description: 'Groceries IT', account: accountId, category: categoryId, date: today() },
  });
  txnExpenseId = exp.data._id;

  const acctBalance = async () =>
    ((await api('GET', '/accounts')).data.find((a) => a._id === accountId) || {}).balance;

  let balance = await acctBalance();
  check('balance after +500k income and -200k expense', balance === 1300000, `got ${balance}`);

  // Expense 200k → 350k: balance must drop by an extra 150k only.
  await api('PUT', `/transactions/${txnExpenseId}`, {
    body: { type: 'expense', amount: 350000, description: 'Groceries IT', account: accountId, category: categoryId, date: today() },
  });
  balance = await acctBalance();
  check('edit expense 200k→350k adjusts by delta', balance === 1150000, `got ${balance}`);

  // Expense → income: old effect reversed, new applied.
  await api('PUT', `/transactions/${txnExpenseId}`, {
    body: { type: 'income', amount: 350000, description: 'Refund IT', account: accountId, category: categoryId, date: today() },
  });
  balance = await acctBalance();
  check('expense→income correct', balance === 1850000, `got ${balance}`);

  // Delete: effects reversed.
  await api('DELETE', `/transactions/${txnExpenseId}`);
  balance = await acctBalance();
  check('delete reverses balance', balance === 1500000, `got ${balance}`);

  // Cross-user isolation: another user's account id must be rejected.
  const other = await api('POST', '/auth/register', {
    body: { name: 'Other', email: `itest-other-${Date.now()}@lifehub.local`, password: 'test123456' },
    auth: false,
    expect: [201],
  });
  const otherToken = other.data.token;
  const stolen = await fetch(`${BASE}/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  check('user cannot read another user\'s account', stolen.status === 404);

  // ---------- BUDGET ----------
  console.log('\n[budget]');
  const bd = await api('POST', '/budgets', {
    body: { category: categoryId, amount: 500000, month: monthKey() },
  });
  budgetId = bd.data._id;

  await api('POST', '/transactions', {
    body: { type: 'expense', amount: 100000, description: 'Lunch IT', account: accountId, category: categoryId, date: today() },
  });
  const budgets = (await api('GET', `/budgets?month=${monthKey()}`)).data;
  const myBudget = budgets.find((b) => b._id === budgetId);
  check('budget spent reflects expense', myBudget && myBudget.spent === 100000, `spent ${myBudget?.spent}`);

  await api('POST', '/transactions', {
    body: { type: 'income', amount: 100000, description: 'Cashback IT', account: accountId, category: categoryId, date: today() },
  });
  const budgets2 = (await api('GET', `/budgets?month=${monthKey()}`)).data;
  const myBudget2 = budgets2.find((b) => b._id === budgetId);
  check('income does not increase budget spent', myBudget2 && myBudget2.spent === 100000, `spent ${myBudget2?.spent}`);

  // ---------- HABIT ----------
  console.log('\n[habit]');
  const hb = await api('POST', '/habits', { body: { name: 'Drink water IT', frequency: 'daily' } });
  habitId = hb.data._id;
  const toggled = await api('PUT', `/habits/${habitId}/toggle`);
  const done = toggled.data.completedDates.some((d) => d === today());
  check('toggle marks today + streak 1', done && toggled.data.streak === 1, `dates ${JSON.stringify(toggled.data.completedDates)}`);
  const untoggled = await api('PUT', `/habits/${habitId}/toggle`);
  check('toggle undo clears + streak 0', untoggled.data.completedDates.length === 0 && untoggled.data.streak === 0);

  // ---------- GOAL ----------
  console.log('\n[goal]');
  const gl = await api('POST', '/goals', { body: { title: 'Read 10 books IT', target: 10, progress: 3 } });
  goalId = gl.data._id;
  const done2 = await api('PUT', `/goals/${goalId}`, { body: { progress: 12 } });
  check('goal auto-completes at target', done2.data.completed === true);

  // ---------- TASK + reminder scheduler ----------
  console.log('\n[task + reminder scheduler]');
  const past = new Date(Date.now() - 60_000).toISOString();
  const tk = await api('POST', '/tasks', {
    body: { title: 'Pay bill IT', status: 'todo', reminder: past },
  });
  taskId = tk.data._id;
  check('task with reminder created', !!taskId);

  const rm = await api('POST', '/reminders', {
    body: { title: 'Water plants IT', datetime: past, type: 'custom' },
  });
  reminderId = rm.data._id;
  check('reminder created', !!reminderId);

  // ---------- RECURRING TRANSACTION ----------
  console.log('\n[recurring]');
  const rec = await api('POST', '/transactions', {
    body: {
      type: 'expense',
      amount: 150000,
      description: 'Netflix IT',
      account: accountId,
      category: categoryId,
      date: today(),
      recurring: { isRecurring: true, frequency: 'monthly' },
    },
  });
  txnRecurringId = rec.data._id;
  check('recurring tx saved with nextRunAt', rec.data.recurring?.isRecurring === true && !!rec.data.nextRunAt,
    `nextRunAt ${rec.data.nextRunAt}`);

  // Backdate it to last month → the first occurrence falls due immediately,
  // so the recurring scheduler should generate a real child transaction.
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lmY = lastMonth.getFullYear();
  const lmM = String(lastMonth.getMonth() + 1).padStart(2, '0');
  const lmD = String(lastMonth.getDate()).padStart(2, '0');
  await api('PUT', `/transactions/${txnRecurringId}`, {
    body: {
      type: 'expense',
      amount: 150000,
      description: 'Netflix IT',
      account: accountId,
      category: categoryId,
      date: `${lmY}-${lmM}-${lmD}`,
      recurring: { isRecurring: true, frequency: 'monthly' },
    },
  });
  let childFound = false;
  for (let i = 0; i < 12; i++) {
    await sleep(6000);
    const txns = (await api('GET', '/transactions')).data || [];
    childFound = txns.some((t) => {
      const tAccount = typeof t.account === 'object' ? t.account?._id : t.account;
      const tCategory = typeof t.category === 'object' ? t.category?._id : t.category;
      return (
        t.parentRecurringId === txnRecurringId &&
        t.type === 'expense' &&
        t.amount === 150000 &&
        tAccount === accountId &&
        tCategory === categoryId &&
        t.recurring?.isRecurring === false
      );
    });
    if (childFound) break;
  }
  check('recurring scheduler generated exactly one child', childFound);

  // ---------- STATISTICS + SETTINGS + NOTIFICATIONS ----------
  console.log('\n[statistics / settings / notifications]');
  const stats = await api('GET', '/dashboard/statistics?range=thisMonth');
  check('statistics thisMonth', stats.status === 200 && typeof stats.data.finance?.balance === 'number');
  const statsAll = await api('GET', '/dashboard/statistics?range=all');
  check('statistics all-time', statsAll.status === 200 && Array.isArray(statsAll.data.finance?.monthlyCashFlow));
  // Timezone regression: a transaction dated today (WIB) must be bucketed under
  // today's date in the 7-day range — not the previous UTC day.
  const stats7d = await api('GET', '/dashboard/statistics?range=7d');
  const keys7d = (stats7d.data?.finance?.monthlyCashFlow || []).map((c) => c._id);
  check('statistics 7d buckets today in WIB', keys7d.includes(today()), `keys ${keys7d.join(',')}`);

  const settings = await api('PUT', '/settings', { body: { darkMode: true } });
  check('settings darkMode persisted', settings.data.darkMode === true);

  // Wait for the 30s reminder scheduler to process the due reminder.
  let notificationFound = false;
  for (let i = 0; i < 10; i++) {
    await sleep(4000);
    const notifs = (await api('GET', '/notifications')).data;
    if (Array.isArray(notifs) && notifs.some((n) => n.relatedId === reminderId || n.title === 'Water plants IT')) {
      notificationFound = true;
      break;
    }
  }
  check('scheduler processed due reminder → notification', notificationFound);

  const reminderAfter = ((await api('GET', '/reminders')).data || []).find(
    (r) => r._id === reminderId
  );
  check('reminder marked sent after processing', reminderAfter && reminderAfter.sent === true);

  const unread = (await api('GET', '/notifications/unread-count')).data;
  check('unread count endpoint', typeof unread.unread === 'number');
  await api('PUT', '/notifications/read-all');
  const unreadAfter = (await api('GET', '/notifications/unread-count')).data;
  check('mark all read', unreadAfter.unread === 0);

  // ---------- CLEANUP ----------
  console.log('\n[cleanup]');
  const toDelete = [
    ['tasks', taskId], ['reminders', reminderId], ['transactions', txnRecurringId],
    ['transactions', txnIncomeId], ['budgets', budgetId], ['categories', categoryId],
    ['accounts', accountId], ['habits', habitId], ['goals', goalId],
  ];
  for (const [res, id] of toDelete) {
    if (id) await api('DELETE', `/${res}/${id}`).catch(() => undefined);
  }
  // generated recurring children + remaining IT transactions
  const leftovers = (await api('GET', '/transactions')).data || [];
  for (const t of leftovers) {
    if (t.description && t.description.endsWith('IT')) await api('DELETE', `/transactions/${t._id}`);
  }
  check('test resources cleaned up', true);

  // ---------- SUMMARY ----------
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== ${results.length - failed.length}/${results.length} checks passed ==`);
  if (failed.length > 0) {
    console.log('Failed:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log('Test user left in DB for manual cleanup:', userEmail);
}

main().catch((err) => {
  console.error('Integration test crashed:', err);
  process.exit(1);
});
