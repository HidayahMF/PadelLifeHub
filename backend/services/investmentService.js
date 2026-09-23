// Investment service — the single source of truth for investment math.
//
// All values are DERIVED from the stored InvestmentTransaction documents at
// read time, so edits/deletes always stay consistent (no cached balance that
// can drift). Every query is scoped to a `userId` that comes from the JWT.
//
// Money is stored as plain Number (matching the rest of the app). Totals are
// rounded to whole Rupiah to avoid floating-point drift on display.

const Transaction = require('../models/InvestmentTransaction');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const roundMoney = (n) => Math.round(Number(n) || 0);

/**
 * Aggregate totals for a single portfolio's transaction records.
 * Pass an array of InvestmentTransaction docs (or a query result) plus the
 * user id. Returns stable, rounded integer-ish figures.
 */
function computePortfolioTotals(records) {
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalGains = 0;
  let totalLosses = 0;
  for (const r of records) {
    const amount = Number(r.amount) || 0;
    if (amount <= 0) continue;
    switch (r.type) {
      case 'deposit':
        totalDeposits += amount;
        break;
      case 'withdrawal':
        totalWithdrawals += amount;
        break;
      case 'gain':
        totalGains += amount;
        break;
      case 'loss':
        totalLosses += amount;
        break;
      default:
        break;
    }
  }
  return {
    totalDeposits: roundMoney(totalDeposits),
    totalWithdrawals: roundMoney(totalWithdrawals),
    totalGains: roundMoney(totalGains),
    totalLosses: roundMoney(totalLosses),
  };
}

/**
 * All derived stats for a portfolio given its transaction records.
 *
 * Formulas:
 *   currentValue       = deposits + gains - losses - withdrawals
 *   netCapitalInvested = deposits - withdrawals
 *   profitLoss         = gains - losses            (= currentValue - netCapital)
 *   returnPct          = profitLoss / netCapital * 100 (0 when netCapital <= 0)
 */
function summarize(records) {
  const { totalDeposits, totalWithdrawals, totalGains, totalLosses } =
    computePortfolioTotals(records);

  const currentValue = roundMoney(
    totalDeposits + totalGains - totalLosses - totalWithdrawals
  );
  const netCapitalInvested = roundMoney(totalDeposits - totalWithdrawals);
  const profitLoss = roundMoney(totalGains - totalLosses);
  const returnPct =
    netCapitalInvested > 0 ? (profitLoss / netCapitalInvested) * 100 : 0;

  return {
    totalDeposits,
    totalWithdrawals,
    totalGains,
    totalLosses,
    currentValue,
    netCapitalInvested,
    profitLoss,
    returnPct: round2(returnPct),
  };
}

/** Sum of value changes (gain - loss) in a period — cash flows excluded. */
function valueChangeIn(records, start, end) {
  let change = 0;
  for (const r of records) {
    const d = new Date(r.transaction_date);
    if (start && d < start) continue;
    if (end && d >= end) continue;
    if (r.type === 'gain') change += Number(r.amount) || 0;
    else if (r.type === 'loss') change -= Number(r.amount) || 0;
  }
  return roundMoney(change);
}

function classifyValueChange(previousValue, currentValue) {
  const difference = roundMoney(Number(currentValue) - Number(previousValue));
  return {
    difference,
    type: difference > 0 ? 'gain' : difference < 0 ? 'loss' : 'none',
    amount: Math.abs(difference),
  };
}

module.exports = {
  computePortfolioTotals,
  summarize,
  valueChangeIn,
  classifyValueChange,
};
