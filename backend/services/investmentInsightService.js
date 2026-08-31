// Loads investment data for AI insights — all read-only and user-scoped.
// Exposes plain numbers so the AI controller can embed authoritative figures
// verbatim in prompts (the same anti-hallucination pattern used elsewhere).

const mongoose = require('mongoose');
const Investment = require('../models/Investment');
const InvestmentTransaction = require('../models/InvestmentTransaction');
const { summarize, valueChangeIn } = require('./investmentService');

// Mongoose buffers writes/queries when the driver is NOT connected, which would
// hang AI-context builds inside unit tests (they stub models, no DB). Guard so
// the AI financial context degrades gracefully to "no investment" when the
// connection isn't up — this only affects the AI context path.
function dbConnected() {
  try {
    return mongoose.connection.readyState === 1;
  } catch {
    return false;
  }
}

/** Aggregate investment overview across all the user's portfolios. */
async function loadInvestmentOverview(userId, { today = new Date() } = {}) {
  if (!dbConnected()) {
    return {
      hasInvestment: false,
      count: 0,
      currentValue: 0,
      totalInvested: 0,
      netCapitalInvested: 0,
      profitLoss: 0,
      returnPct: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalGains: 0,
      totalLosses: 0,
      todayChange: 0,
      weekChange: 0,
      monthChange: 0,
    };
  }
  const [portfolios, records] = await Promise.all([
    Investment.find({ user: userId }),
    InvestmentTransaction.find({ user: userId }),
  ]);

  let currentValue = 0;
  let netCapital = 0;
  let profitLoss = 0;
  let deposits = 0;
  let withdrawals = 0;
  let gains = 0;
  let losses = 0;
  for (const p of portfolios) {
    const own = records.filter((r) => String(r.investment) === String(p._id));
    const s = summarize(own);
    currentValue += s.currentValue;
    netCapital += s.netCapitalInvested;
    profitLoss += s.profitLoss;
    deposits += s.totalDeposits;
    withdrawals += s.totalWithdrawals;
    gains += s.totalGains;
    losses += s.totalLosses;
  }

  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Week = last 7 days (incl. today).
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const returnPct = netCapital > 0 ? (profitLoss / netCapital) * 100 : 0;

  return {
    hasInvestment: portfolios.length > 0,
    count: portfolios.length,
    currentValue,
    totalInvested: deposits,
    netCapitalInvested: netCapital,
    profitLoss,
    returnPct: Math.round((returnPct + Number.EPSILON) * 100) / 100,
    totalDeposits: deposits,
    totalWithdrawals: withdrawals,
    totalGains: gains,
    totalLosses: losses,
    todayChange: valueChangeIn(records, dayStart, dayEnd),
    weekChange: valueChangeIn(records, weekStart, dayEnd),
    monthChange: valueChangeIn(records, monthStart, monthEnd),
  };
}

/**
 * Count how many of the last `days` day-windows (ending today, inclusive) had
 * a positive value change (gains > losses) vs a negative one. Days with no
 * activity are not counted either way.
 */
function dayDirectionStats(records, days, today) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const byDay = new Map();
  for (const r of records) {
    const d = new Date(r.transaction_date);
    if (d < start || d >= end) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const net =
      r.type === 'gain' ? Number(r.amount) || 0 : r.type === 'loss' ? -(Number(r.amount) || 0) : 0;
    byDay.set(key, (byDay.get(key) || 0) + net);
  }
  let positiveDays = 0;
  let negativeDays = 0;
  let activeDays = 0;
  for (const net of byDay.values()) {
    if (net > 0) positiveDays += 1;
    else if (net < 0) negativeDays += 1;
    if (net !== 0) activeDays += 1;
  }
  return { positiveDays, negativeDays, activeDays };
}

module.exports = { loadInvestmentOverview, dayDirectionStats };
