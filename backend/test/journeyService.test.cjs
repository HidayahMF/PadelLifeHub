const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dayKey, collectActiveDays } = require('../services/journeyService');

test('journey dates use the Asia/Jakarta calendar day', () => {
  assert.equal(dayKey('2026-09-19T17:30:00.000Z'), '2026-09-20');
});

test('active days deduplicate multiple activities on the same day', () => {
  const days = collectActiveDays({
    notes: [
      { createdAt: '2026-09-20T01:00:00.000Z' },
      { createdAt: '2026-09-20T12:00:00.000Z' },
    ],
    tasks: [
      { createdAt: '2026-09-20T02:00:00.000Z', status: 'completed', completedAt: '2026-09-20T13:00:00.000Z' },
    ],
    transactions: [{ createdAt: '2026-09-20T03:00:00.000Z' }],
  });

  assert.deepEqual([...days], ['2026-09-20']);
});

test('active days keep separate calendar dates and exclude scheduler-created records', () => {
  const days = collectActiveDays({
    notes: [{ createdAt: '2026-09-20T10:00:00.000Z' }],
    tasks: [
      { recurrenceId: 'parent-task', createdAt: '2026-09-21T01:00:00.000Z', status: 'todo' },
      { createdAt: '2026-09-21T02:00:00.000Z', status: 'completed', completedAt: '2026-09-21T16:00:00.000Z' },
    ],
    transactions: [{ parentRecurringId: 'parent-transaction', createdAt: '2026-09-22T01:00:00.000Z' }],
  });

  assert.deepEqual([...days].sort(), ['2026-09-20', '2026-09-21']);
});

test('missing completion timestamps do not create unverifiable active days', () => {
  const days = collectActiveDays({
    tasks: [{ createdAt: '2026-09-20T01:00:00.000Z', status: 'completed', completedAt: null }],
  });

  assert.deepEqual([...days], ['2026-09-20']);
});
