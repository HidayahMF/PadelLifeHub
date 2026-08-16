// LifeHub Reminder Scheduler tests.
//
// Verifies the bug-fix guarantees:
//   - completed / deleted / archived / trashed tasks NEVER produce a NEW
//     notification (both the Task.reminder path and the Reminder-doc path).
//   - a reminder is claimed atomically → running tick() twice can never
//     double-send.
//   - recurring reminders re-arm while the task is active and STOP when the
//     task is completed or deleted.
//   - task completion/deletion clean up linked Reminder docs.
//
// All Mongoose models are stubbed via require.cache (no DB, no network),
// following the same pattern as aiApi.test.cjs.

const { test } = require('node:test');
const assert = require('node:assert');

const USER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const past = () => new Date(Date.now() - 60_000);
const future = () => new Date(Date.now() + 3_600_000);

// ---------------------------------------------------------------------------
// Behavior buckets — live arrays so claims/mutations persist across ticks.
// ---------------------------------------------------------------------------
const behavior = {
  reminders: [],
  tasks: [],
  goals: [],
  budgets: [],
  habits: [],
  notifications: [],
  settings: null,
  user: { _id: USER, email: 'a@test.dev' },
  emailCalls: [],
  // When true, the Task.find stub skips status/archived/trashed filtering so
  // tests can exercise the atomic claim's own state re-validation (race).
  bypassFindStatus: false,
};

function reset() {
  behavior.reminders.length = 0;
  behavior.tasks.length = 0;
  behavior.goals.length = 0;
  behavior.budgets.length = 0;
  behavior.habits.length = 0;
  behavior.notifications.length = 0;
  behavior.emailCalls.length = 0;
  behavior.settings = null;
  behavior.bypassFindStatus = false;
}

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

function stubModule(relativePath, exportsObj) {
  const resolved = require.resolve(relativePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsObj,
  };
}

// ---------------------------------------------------------------------------
// Fixture builders.
// ---------------------------------------------------------------------------
function makeTask(overrides = {}) {
  const t = {
    _id: `t${behavior.tasks.length + 1}`,
    user: USER,
    title: 'tes',
    status: 'todo',
    archived: false,
    trashed: false,
    reminder: past(),
    reminderSentAt: null,
    dueDate: future(),
    save: async function () { return this; },
    ...overrides,
  };
  behavior.tasks.push(t);
  return t;
}

function makeReminder(overrides = {}) {
  const r = {
    _id: `r${behavior.reminders.length + 1}`,
    user: USER,
    title: 'tes',
    datetime: past(),
    type: 'custom',
    relatedId: null,
    recurring: null,
    sent: false,
    active: true,
    save: async function () { return this; },
    ...overrides,
  };
  behavior.reminders.push(r);
  return r;
}

// ---------------------------------------------------------------------------
// Reminder model stub.
// ---------------------------------------------------------------------------
function matchesReminderFilter(r, filter) {
  if (filter.active !== undefined && r.active !== filter.active) return false;
  if (filter.sent !== undefined && r.sent !== filter.sent) return false;
  if (filter.datetime && filter.datetime.$lte) {
    if (!r.datetime || r.datetime > filter.datetime.$lte) return false;
  }
  return true;
}

stubModule('../models/Reminder', {
  find: (filter) => chain(() => behavior.reminders.filter((r) => matchesReminderFilter(r, filter))),
  findOne: async (filter) =>
    behavior.reminders.find((r) => String(r._id) === String(filter?._id)) || null,
  findOneAndUpdate: async (filter, update) => {
    const target = behavior.reminders.find((r) => String(r._id) === String(filter?._id));
    if (!target) return null;
    if (filter.sent !== undefined && target.sent !== filter.sent) return null;
    if (filter.active !== undefined && target.active !== filter.active) return null;
    Object.assign(target, update?.$set || {});
    return target;
  },
  updateMany: async (filter, update) => {
    let modified = 0;
    behavior.reminders.forEach((r) => {
      if (
        String(r.user) === String(filter.user) &&
        r.type === filter.type &&
        String(r.relatedId) === String(filter.relatedId) &&
        (filter.active === undefined || r.active === filter.active)
      ) {
        Object.assign(r, update?.$set || {});
        modified += 1;
      }
    });
    return { modifiedCount: modified };
  },
  deleteMany: async (filter) => {
    const before = behavior.reminders.length;
    behavior.reminders = behavior.reminders.filter((r) => {
      const matchesUser = filter.user === undefined || String(r.user) === String(filter.user);
      const matchesType = filter.type === undefined || r.type === filter.type;
      const matchesRelated =
        filter.relatedId === undefined || String(r.relatedId) === String(filter.relatedId);
      return !(matchesUser && matchesType && matchesRelated);
    });
    return { deletedCount: before - behavior.reminders.length };
  },
});

// ---------------------------------------------------------------------------
// Task model stub.
// ---------------------------------------------------------------------------
function matchesTaskFilter(t, filter) {
  if (t.reminderSentAt !== null) return false;
  if (!t.reminder) return false;
  if (filter.reminder && filter.reminder.$lte && t.reminder > filter.reminder.$lte) return false;
  if (!behavior.bypassFindStatus) {
    if (t.status === 'completed') return false;
    if (t.archived) return false;
    if (t.trashed) return false;
  }
  return true;
}

stubModule('../models/Task', {
  find: (filter) => chain(() => behavior.tasks.filter((t) => matchesTaskFilter(t, filter))),
  findOne: async (filter) =>
    behavior.tasks.find(
      (t) => String(t._id) === String(filter?._id) && String(t.user) === String(filter?.user)
    ) || null,
  findById: (id) => chain(() => behavior.tasks.find((t) => String(t._id) === String(id)) || null),
  findOneAndUpdate: async (filter, update) => {
    const t = behavior.tasks.find((x) => String(x._id) === String(filter?._id));
    if (!t) return null;
    if (t.reminderSentAt !== null) return null;
    if (t.status === 'completed' || t.archived || t.trashed) return null;
    t.reminderSentAt = update?.$set?.reminderSentAt ?? null;
    return t;
  },
  findOneAndDelete: async (filter) => {
    const idx = behavior.tasks.findIndex(
      (t) => String(t._id) === String(filter?._id) && String(t.user) === String(filter?.user)
    );
    if (idx === -1) return null;
    return behavior.tasks.splice(idx, 1)[0];
  },
});

// ---------------------------------------------------------------------------
// Remaining model + email stubs.
// ---------------------------------------------------------------------------
stubModule('../models/Notification', {
  create: async (doc) => {
    const n = { _id: `n${behavior.notifications.length + 1}`, ...doc, createdAt: new Date() };
    behavior.notifications.push(n);
    return n;
  },
  findOne: async () => null,
});
stubModule('../models/Setting', { findOne: async () => behavior.settings });
stubModule('../models/Budget', {
  find: () => chain(() => behavior.budgets),
  findOne: async () => null,
  findOneAndUpdate: async () => null,
});
stubModule('../models/Goal', {
  find: () => chain(() => behavior.goals),
  findById: (id) => chain(() => behavior.goals.find((g) => String(g._id) === String(id)) || null),
});
stubModule('../models/Habit', { find: () => chain(() => behavior.habits) });
stubModule('../models/User', {
  findById: () => chain(() => behavior.user),
});
stubModule('../services/emailService', {
  sendNotification: async (email, { subject, message }) => {
    behavior.emailCalls.push({ email, subject, message });
  },
});

// Category stub — only needed by taskController (validateCategory).
stubModule('../models/Category', { findOne: async () => null });

const { tick, cleanupTaskReminders } = require('../services/reminderScheduler');
const taskController = require('../controllers/taskController');

const taskNotifs = () => behavior.notifications.filter((n) => n.message.startsWith('Task due reminder'));
const reminderNotifs = () => behavior.notifications.filter((n) => n.message.startsWith('Reminder'));

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

test('active task due → exactly one task notification, reminderSentAt set', async () => {
  reset();
  makeTask({ title: 'tes' });
  await tick();
  assert.strictEqual(taskNotifs().length, 1);
  assert.strictEqual(taskNotifs()[0].message, 'Task due reminder — tes');
  assert.ok(behavior.tasks[0].reminderSentAt instanceof Date);
});

test('completed task → NO notification', async () => {
  reset();
  makeTask({ title: 'tes', status: 'completed', reminder: past() });
  await tick();
  assert.strictEqual(taskNotifs().length, 0);
  assert.strictEqual(behavior.tasks[0].reminderSentAt, null);
});

test('task completed between find and claim → NO notification (atomic re-check)', async () => {
  reset();
  behavior.bypassFindStatus = true;
  makeTask({ title: 'tes', status: 'completed', reminder: past() });
  await tick();
  assert.strictEqual(taskNotifs().length, 0);
  assert.strictEqual(behavior.tasks[0].reminderSentAt, null);
});

test('deleted task → linked reminder deactivated, NO notification', async () => {
  reset();
  const task = makeTask({ reminder: null });
  const rem = makeReminder({ type: 'task', relatedId: task._id });
  behavior.tasks.length = 0;
  await tick();
  assert.strictEqual(reminderNotifs().length, 0);
  assert.strictEqual(rem.active, false);
  assert.strictEqual(rem.sent, true);
});

test('cancelled reminder (active=false) → NO notification', async () => {
  reset();
  makeReminder({ type: 'custom', active: false });
  await tick();
  assert.strictEqual(reminderNotifs().length, 0);
});

test('tick() twice → only ONE notification per source', async () => {
  reset();
  makeTask({ title: 'tes' });
  makeReminder({ title: 'tes', type: 'custom' });
  await tick();
  await tick();
  assert.strictEqual(taskNotifs().length, 1);
  assert.strictEqual(reminderNotifs().length, 1);
});

test('linked reminder dedup — task reminder already fired, no second notification', async () => {
  reset();
  const task = makeTask({ title: 'tes' });
  makeReminder({ type: 'task', relatedId: task._id, title: 'tes' });
  await tick();
  assert.strictEqual(taskNotifs().length, 1);
  assert.strictEqual(reminderNotifs().length, 0);
  assert.strictEqual(behavior.reminders[0].active, false);
});

test('task completed before due → NO notification when time arrives', async () => {
  reset();
  const task = makeTask({ title: 'tes', reminder: future() });
  task.status = 'completed';
  await tick();
  assert.strictEqual(taskNotifs().length, 0);
  task.reminder = past();
  await tick();
  assert.strictEqual(taskNotifs().length, 0);
});

test('task deleted before due → NO notification + stale reminder cleaned when due', async () => {
  reset();
  const task = makeTask({ reminder: null });
  const rem = makeReminder({ type: 'task', relatedId: task._id, datetime: future() });
  behavior.tasks.length = 0;
  await tick();
  assert.strictEqual(reminderNotifs().length, 0);
  rem.datetime = past();
  rem.sent = false;
  await tick();
  assert.strictEqual(reminderNotifs().length, 0);
  assert.strictEqual(rem.active, false);
});

test('recurring reminder re-arms while active, STOPS when task completed', async () => {
  reset();
  const task = makeTask({ reminder: null });
  const rem = makeReminder({
    type: 'task',
    relatedId: task._id,
    recurring: { isRecurring: true, frequency: 'daily' },
  });
  const first = rem.datetime.getTime();

  await tick();
  assert.strictEqual(reminderNotifs().length, 1);
  assert.strictEqual(rem.active, true);
  assert.strictEqual(rem.sent, false);
  assert.ok(rem.datetime.getTime() > first);

  task.status = 'completed';
  rem.datetime = past();
  rem.sent = false;
  await tick();
  assert.strictEqual(reminderNotifs().length, 1);
  assert.strictEqual(rem.active, false);
});

test('cleanupTaskReminders deactivates then removes only linked reminders', async () => {
  reset();
  const task = makeTask({ reminder: null });
  makeReminder({ type: 'task', relatedId: task._id });
  makeReminder({ type: 'task', relatedId: task._id });
  makeReminder({ type: 'custom' });

  await cleanupTaskReminders({ user: USER, taskId: task._id, remove: false });
  const linked = behavior.reminders.filter((r) => r.type === 'task');
  assert.ok(linked.every((r) => r.active === false && r.sent === true));
  assert.strictEqual(behavior.reminders.find((r) => r.type === 'custom').active, true);

  await cleanupTaskReminders({ user: USER, taskId: task._id, remove: true });
  assert.strictEqual(behavior.reminders.filter((r) => r.type === 'task').length, 0);
  assert.strictEqual(behavior.reminders.filter((r) => r.type === 'custom').length, 1);
});

test('updateTask completion deactivates linked reminders', async () => {
  reset();
  const task = makeTask({ reminder: null });
  const rem = makeReminder({ type: 'task', relatedId: task._id });
  const req = { params: { id: task._id }, user: { _id: USER }, body: { status: 'completed' } };
  const res = { statusCode: 0, json: () => {}, status(c) { this.statusCode = c; return this; } };
  await taskController.updateTask(req, res, () => {});
  assert.strictEqual(rem.active, false);
  assert.strictEqual(rem.sent, true);
});

test('deleteTask removes linked reminders', async () => {
  reset();
  const task = makeTask({ reminder: null });
  makeReminder({ type: 'task', relatedId: task._id });
  const req = { params: { id: task._id }, user: { _id: USER } };
  const res = { statusCode: 0, json: () => {}, status(c) { this.statusCode = c; return this; } };
  await taskController.deleteTask(req, res, () => {});
  assert.strictEqual(behavior.reminders.filter((r) => r.type === 'task').length, 0);
  assert.strictEqual(behavior.tasks.length, 0);
});
