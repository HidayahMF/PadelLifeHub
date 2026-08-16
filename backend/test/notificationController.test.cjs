// LifeHub Notification controller tests.
//
// Verifies the stale-notification fix:
//   - "Task due reminder — …" notifications whose linked task was deleted,
//     completed, archived or trashed are pruned from GET /notifications (and
//     removed from the store), so they can never be re-surfaced as a browser
//     popup on every page refresh.
//   - Notifications for live tasks (and all non-task notifications) are kept.
//
// Models are stubbed via require.cache (no DB, no network), following the
// same pattern as reminderScheduler.test.cjs.

const { test } = require('node:test');
const assert = require('node:assert');

const USER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const taskId = (n) => `task${n}`;
const notifId = (n) => `notif${n}`;

const behavior = {
  notifications: [],
  tasks: [],
};

function reset() {
  behavior.notifications.length = 0;
  behavior.tasks.length = 0;
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

// Chainable query supporting .select(), .lean(), .sort() and .limit(), resolved by then().
function chainQuery(getDocs) {
  const q = {
    select() { return q; },
    lean() { return q; },
    sort() { return q; },
    limit() { return q; },
    then(resolve) { resolve(getDocs()); },
  };
  return q;
}

function makeNotif(type, relatedId, read = false) {
  const n = {
    _id: notifId(behavior.notifications.length + 1),
    user: USER,
    type,
    relatedId,
    title: 't',
    message: 'm',
    read,
    createdAt: new Date(),
  };
  behavior.notifications.push(n);
  return n;
}

function makeTask(status, opts = {}) {
  const t = {
    _id: taskId(behavior.tasks.length + 1),
    user: USER,
    status,
    archived: false,
    trashed: false,
    ...opts,
  };
  behavior.tasks.push(t);
  return t;
}

stubModule('../models/Notification', {
  find: (filter) =>
    chainQuery(() =>
      behavior.notifications.filter((n) => String(n.user) === String(filter?.user))
    ),
  findOne: async () => null,
  deleteMany: async (filter) => {
    behavior.notifications = behavior.notifications.filter((n) => {
      if (String(n.user) !== String(filter?.user)) return true;
      if (filter?.type && n.type !== filter.type) return true;
      if (filter?.relatedId && String(n.relatedId) !== String(filter.relatedId)) return true;
      if (filter?._id?.$in && !filter._id.$in.some((id) => String(id) === String(n._id))) return true;
      return false;
    });
  },
});

stubModule('../models/Task', {
  find: (filter) =>
    chainQuery(() => {
      const ids = (filter?._id?.$in || []).map(String);
      return behavior.tasks.filter((t) => ids.includes(String(t._id)));
    }),
});

const { getNotifications } = require('../controllers/notificationController');

const call = async () => {
  let result;
  const res = { json: (value) => { result = value; } };
  await getNotifications({ user: { _id: USER }, query: {} }, res, (err) => {
    throw err;
  });
  return result;
};

test('deleted task → its "Task due reminder" notification is pruned', async () => {
  reset();
  const t = makeTask('todo', { deleted: true });
  behavior.tasks.length = 0; // simulate deletion: task no longer exists
  makeNotif('task', t._id);
  makeNotif('habit', 'habit1');

  const result = await call();
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].type, 'habit');
  assert.strictEqual(behavior.notifications.length, 1);
});

test('completed / archived / trashed task → notification pruned', async () => {
  for (const [status, extra] of [
    ['completed', {}],
    ['todo', { archived: true }],
    ['todo', { trashed: true }],
  ]) {
    reset();
    const t = makeTask(status, extra);
    makeNotif('task', t._id);

    const result = await call();
    assert.strictEqual(result.length, 0, `expected prune for status=${status}`);
    assert.strictEqual(behavior.notifications.length, 0);
  }
});

test('live task → notification kept', async () => {
  reset();
  const t = makeTask('todo');
  makeNotif('task', t._id);

  const result = await call();
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].type, 'task');
  assert.strictEqual(behavior.notifications.length, 1);
});
