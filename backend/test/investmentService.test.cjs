const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarize, computePortfolioTotals, valueChangeIn, classifyValueChange } = require('../services/investmentService');

function tx(type, amount, date = '2026-01-01') {
  return { type, amount, transaction_date: date };
}

const base = '2026-01-01';

test('Scenario 1: deposit 5,000,000 → value 5,000,000, P/L 0', () => {
  const s = summarize([tx('deposit', 5000000, base)]);
  assert.equal(s.currentValue, 5000000);
  assert.equal(s.netCapitalInvested, 5000000);
  assert.equal(s.profitLoss, 0);
  assert.equal(s.returnPct, 0);
  assert.equal(s.totalDeposits, 5000000);
});

test('Scenario 2: deposit 5,000,000 + gain 500,000 → value 5,500,000, profit +500,000', () => {
  const s = summarize([
    tx('deposit', 5000000, base),
    tx('gain', 500000, '2026-01-02'),
  ]);
  assert.equal(s.currentValue, 5500000);
  assert.equal(s.profitLoss, 500000);
  assert.equal(s.returnPct, 10);
});

test('Scenario 3: deposit 5,000,000 + loss 500,000 → value 4,500,000, loss -500,000', () => {
  const s = summarize([
    tx('deposit', 5000000, base),
    tx('loss', 500000, '2026-01-02'),
  ]);
  assert.equal(s.currentValue, 4500000);
  assert.equal(s.profitLoss, -500000);
});

test('Scenario 4: deposit 5M + gain 1M + withdraw 2M → value 4M, net capital 3M, profit +1M', () => {
  const s = summarize([
    tx('deposit', 5000000, base),
    tx('gain', 1000000, '2026-01-02'),
    tx('withdrawal', 2000000, '2026-01-03'),
  ]);
  assert.equal(s.currentValue, 4000000);
  assert.equal(s.netCapitalInvested, 3000000);
  assert.equal(s.profitLoss, 1000000);
  assert.equal(s.returnPct, 33.33);
});

test('computePortfolioTotals separates deposit/withdrawal/gain/loss', () => {
  const t = computePortfolioTotals([
    tx('deposit', 1000000),
    tx('deposit', 2000000),
    tx('withdrawal', 500000),
    tx('gain', 300000),
    tx('loss', 200000),
  ]);
  assert.equal(t.totalDeposits, 3000000);
  assert.equal(t.totalWithdrawals, 500000);
  assert.equal(t.totalGains, 300000);
  assert.equal(t.totalLosses, 200000);
});

test('valueChangeIn only sums gain-loss within the window', () => {
  const records = [
    tx('gain', 100000, '2026-01-01'),
    tx('loss', 30000, '2026-01-02'),
    tx('deposit', 9000000, '2026-01-03'), // capital — excluded
    tx('gain', 50000, '2026-01-04'),
  ];
  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 0, 5);
  // 100000 - 30000 + 50000 = 120000
  assert.equal(valueChangeIn(records, start, end), 120000);
});

test('empty records produce zero-value summary', () => {
  const s = summarize([]);
  assert.equal(s.currentValue, 0);
  assert.equal(s.netCapitalInvested, 0);
  assert.equal(s.profitLoss, 0);
  assert.equal(s.returnPct, 0);
});

test('sync value classification derives gain, loss, or no transaction', () => {
  assert.deepStrictEqual(classifyValueChange(59222000, 59500000), {
    difference: 278000,
    type: 'gain',
    amount: 278000,
  });
  assert.deepStrictEqual(classifyValueChange(59500000, 58900000), {
    difference: -600000,
    type: 'loss',
    amount: 600000,
  });
  assert.deepStrictEqual(classifyValueChange(59500000, 59500000), {
    difference: 0,
    type: 'none',
    amount: 0,
  });
});
