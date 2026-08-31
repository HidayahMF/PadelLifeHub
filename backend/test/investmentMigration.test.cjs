const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const USER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';

// ── In-memory stores ────────────────────────────────────────────────────────
const store = {
  categories: [],
  transactions: [],
  investments: [],
  investmentTransactions: [],
};

function reset() {
  store.categories.length = 0;
  store.transactions.length = 0;
  store.investments.length = 0;
  store.investmentTransactions.length = 0;
  clearCache();
}

function clearCache() {
  // Re-register module stubs fresh each run so `require` returns our mocks.
  registerStubs();
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

function registerStubs() {
  stubModule('../models/Investment', {
    find(filter = {}) {
      const list = store.investments.filter((i) => !filter.user || String(i.user) === String(filter.user));
      return chain(() => list.map((i) => ({ ...i })));
    },
    findOne(filter = {}) {
      const i = store.investments.find(
        (x) => (!filter.user || String(x.user) === String(filter.user)) &&
          (!filter.name || x.name === filter.name)
      );
      return chain(() => (i ? { ...i, save: async () => i } : null));
    },
    create(doc) {
      const d = { _id: `inv_${store.investments.length + 1}`, ...doc };
      store.investments.push(d);
      return Promise.resolve({ ...d });
    },
  });

  stubModule('../models/InvestmentTransaction', {
    create(doc) {
      const d = { _id: `it_${store.investmentTransactions.length + 1}`, ...doc };
      store.investmentTransactions.push(d);
      return Promise.resolve({ ...d });
    },
    deleteMany(filter = {}) {
      const before = store.investmentTransactions.length;
      const ids = filter._id?.$in || [];
      store.investmentTransactions = store.investmentTransactions.filter(
        (t) => !ids.length || !ids.includes(String(t._id))
      );
      return Promise.resolve({ deletedCount: before - store.investmentTransactions.length });
    },
  });

  stubModule('../models/Transaction', {
    find(filter = {}) {
      const list = store.transactions.filter((t) => {
        if (filter.user && String(t.user) !== String(filter.user)) return false;
        if (filter.type && t.type !== filter.type) return false;
        if (filter._id && filter._id.$in) {
          if (!filter._id.$in.includes(String(t._id))) return false;
        }
        if (filter.category && filter.category.$in) {
          if (!filter.category.$in.includes(String(t.category))) return false;
        }
        if (filter.migratedToInvestment && filter.migratedToInvestment.$ne === true) {
          if (t.migratedToInvestment) return false; // exclude migrated
        }
        return true;
      });
      return chain(() => list.map((t) => ({ ...t, toObject: () => ({ ...t }) })));
    },
    updateOne(filter, update) {
      const t = store.transactions.find((x) => String(x._id) === String(filter._id));
      if (t) Object.assign(t, update);
      return Promise.resolve({ n: t ? 1 : 0 });
    },
    updateMany(filter, update) {
      const matches = store.transactions.filter(
        (t) => !filter.user || String(t.user) === String(filter.user)
      );
      for (const t of matches) Object.assign(t, update);
      return Promise.resolve({ n: matches.length });
    },
  });

  stubModule('../models/Category', {
    find(filter = {}) {
      const list = store.categories.filter(
        (c) => (!filter.user || String(c.user) === String(filter.user)) &&
          (!filter.type || c.type === filter.type)
      );
      return chain(() => list.map((c) => ({ ...c })));
    },
  });
}

// ── Helpers to seed -----------------------------------------------------------------
function seedCategory(id, name) {
  store.categories.push({ _id: id, user: USER, name, type: 'transaction' });
}
function seedTxn(id, { type = 'expense', amount = 0, date = '2026-01-01', category = null, desc = '', user = USER, migrated = false, invRef = null }) {
  store.transactions.push({ _id: id, user, type, amount, date, category, description: desc, migratedToInvestment: migrated, investmentTransactionId: invRef });
}

reset();

// ── Tests ───────────────────────────────────────────────────────────────────
beforeEach(reset);

test('isExactInvestmentName is narrow (not a broad substring match)', async () => {
  const { isExactInvestmentName, isAmbiguousInvestmentName } = require('../services/investmentMigrationService');
  assert.equal(isExactInvestmentName('Investment'), true);
  assert.equal(isExactInvestmentName('investasi'), true);
  assert.equal(isExactInvestmentName('INVEST'), true);
  assert.equal(isExactInvestmentName('Investigator'), false);
  assert.equal(isExactInvestmentName('Investment Trading Fund'), false);
  assert.equal(isAmbiguousInvestmentName('Investment Trading Fund'), true);
  assert.equal(isAmbiguousInvestmentName('Investor Club'), true);
  assert.equal(isAmbiguousInvestmentName('Investment'), false);
});

test('analyze (dry run) returns correct totals, categories, count, date range; no DB writes', async () => {
  const { analyze } = require('../services/investmentMigrationService');
  seedCategory('cat_inv', 'Investment');
  seedCategory('cat_shopping', 'Shopping');
  seedCategory('cat_amb', 'Investment Trading Fund');
  seedTxn('t1', { amount: 5000000, date: '2026-07-01', category: 'cat_inv' });
  seedTxn('t2', { amount: 1000000, date: '2026-08-15', category: 'cat_inv' });
  seedTxn('t3', { amount: 2000000, date: '2026-08-20', category: 'cat_inv' });
  seedTxn('t4', { amount: 300000, date: '2026-08-20', category: 'cat_shopping' }); // NOT investment
  seedTxn('t5', { amount: 400000, date: '2026-08-21', category: 'cat_amb' }); // ambiguous — excluded

  const before = {
    txnCount: store.transactions.length,
    itCount: store.investmentTransactions.length,
    invCount: store.investments.length,
  };
  const r = await analyze(USER);

  assert.equal(r.count, 3);
  assert.equal(r.totalAmount, 8000000);
  assert.deepEqual(r.exactInvestmentCategoryIds, ['cat_inv']);
  assert.equal(r.ambiguous.length, 1);
  assert.equal(r.ambiguous[0].name, 'Investment Trading Fund');
  assert.equal(r.byMonth.length, 2);
  assert.equal(r.sample.length, 3);
  // analyze must not write anything
  assert.equal(store.transactions.length, before.txnCount);
  assert.equal(store.investmentTransactions.length, before.itCount);
  assert.equal(store.investments.length, before.invCount);
});

test('analyze ignores already-migrated transactions', async () => {
  const { analyze } = require('../services/investmentMigrationService');
  seedCategory('cat_inv', 'Investment');
  seedTxn('t1', { amount: 5000000, category: 'cat_inv', migrated: true, invRef: 'it_x' });
  seedTxn('t2', { amount: 2000000, category: 'cat_inv' });
  const r = await analyze(USER);
  assert.equal(r.count, 1);
  assert.equal(r.totalAmount, 2000000);
});

test('migrate creates deposits, flags originals, is idempotent (no duplicates)', async () => {
  const { migrate } = require('../services/investmentMigrationService');
  seedCategory('cat_inv', 'Investment');
  seedTxn('t1', { amount: 5000000, date: '2026-07-01', category: 'cat_inv', desc: 'Buy stock' });
  seedTxn('t2', { amount: 2000000, date: '2026-08-01', category: 'cat_inv' });

  const r1 = await migrate(USER, ['t1', 't2']);
  assert.equal(r1.migrated, 2);
  assert.equal(r1.skipped, 0);
  assert.equal(store.investmentTransactions.length, 2);
  assert.equal(store.investments.length, 1); // auto-created "Migrated Investments" portfolio
  for (const t of store.transactions) {
    assert.equal(t.migratedToInvestment, true);
    assert.ok(t.investmentTransactionId);
  }
  assert.equal(store.investmentTransactions[0].type, 'deposit');
  assert.equal(store.investmentTransactions[0].amount, 5000000);
  assert.equal(store.investmentTransactions[0].note, 'Buy stock');

  // Second run → idempotent, nothing duplicated.
  const r2 = await migrate(USER, ['t1', 't2']);
  assert.equal(r2.migrated, 0);
  assert.equal(r2.skipped, 2);
  assert.equal(store.investmentTransactions.length, 2);
});

test('migrate only touches confirmed ids and only investment-named expenses', async () => {
  const { migrate } = require('../services/investmentMigrationService');
  seedCategory('cat_inv', 'Investment');
  seedCategory('cat_shopping', 'Shopping');
  seedTxn('t_inv', { amount: 1000000, category: 'cat_inv' });
  seedTxn('t_shopping', { amount: 500000, category: 'cat_shopping' });
  // asking to migrate the shopping one must do nothing (category not investment)
  const r = await migrate(USER, ['t_shopping']);
  assert.equal(r.migrated, 0);
  assert.equal(store.investmentTransactions.length, 0);
  assert.equal(store.transactions.find((t) => t._id === 't_shopping').migratedToInvestment, false);
});

test('rollback removes ONLY migration-created records and resets only migration-flagged originals', async () => {
  const { migrate, rollback } = require('../services/investmentMigrationService');
  seedCategory('cat_inv', 'Investment');
  seedTxn('t_inv', { amount: 5000000, category: 'cat_inv' });
  // A pre-existing investment record NOT linked to any flagged original — must
  // survive rollback untouched.
  store.investmentTransactions.push({ _id: 'it_preexisting', user: USER, type: 'deposit', amount: 999, note: '' });

  await migrate(USER, ['t_inv']); // creates it_1, flags t_inv
  assert.equal(store.investmentTransactions.length, 2);

  const rb = await rollback(USER);
  assert.equal(rb.removedInvestmentTransactions, 1);
  assert.equal(rb.originalsReset, 1);
  assert.equal(store.investmentTransactions.length, 1);
  assert.equal(store.investmentTransactions[0]._id, 'it_preexisting');
  assert.equal(store.transactions.find((t) => t._id === 't_inv').migratedToInvestment, false);
  assert.equal(store.transactions.find((t) => t._id === 't_inv').investmentTransactionId, null);
});

test('scoped to user: migrate/analyze never touch another user records', async () => {
  const { migrate, analyze } = require('../services/investmentMigrationService');
  seedCategory('cat_inv', 'Investment');
  seedTxn('t_me', { amount: 1000000, category: 'cat_inv', user: USER });
  seedTxn('t_other', { amount: 9000000, category: 'cat_inv', user: OTHER });

  const r = await analyze(USER);
  assert.equal(r.count, 1);
  assert.equal(r.totalAmount, 1000000);

  await migrate(USER, ['t_other']); // cannot migrate another user's txn
  assert.equal(store.investmentTransactions.length, 0);
  assert.equal(store.transactions.find((t) => t._id === 't_other').migratedToInvestment, false);
});
