// Central date helpers — the application runs in Asia/Jakarta (UTC+7).
// server.js sets process.env.TZ so every `new Date()` local-time operation
// (getFullYear/getMonth/getDate/setHours...) is interpreted in WIB.
// All daily tracking (habits, "today" comparisons) uses calendar dates:
// "YYYY-MM-DD" strings, never raw UTC ISO slices.

/** Format a Date as a local (WIB) calendar date string: YYYY-MM-DD. */
function formatLocalDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's calendar date in WIB, e.g. "2026-08-11". */
function getTodayLocalDate() {
  return formatLocalDate(new Date());
}

/** Start of today (local midnight) as a Date. */
function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Add days to a date (local). */
function addLocalDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Normalize a habit completion value (Date object, ISO string, or an already
 * normalized "YYYY-MM-DD" string) to the local calendar date.
 * Legacy entries stored as UTC-midnight Dates map back to the intended WIB day
 * (e.g. 2026-08-11T00:00:00.000Z is 2026-08-11 07:00 WIB).
 */
function normalizeHabitDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatLocalDate(date);
}

/**
 * Parse "YYYY-MM" into { year, month } numbers.
 */
function parseMonthKey(month) {
  const [year, m] = String(month).split('-').map(Number);
  return { year, month: m - 1 };
}

/** First day of the given month as a local Date. */
function monthStart(month) {
  const { year, month: m } = parseMonthKey(month);
  return new Date(year, m, 1);
}

/** First day of the month after the given month. */
function nextMonthStart(month) {
  const { year, month: m } = parseMonthKey(month);
  return new Date(year, m + 1, 1);
}

const DAY_MS = 86_400_000;

/** Integer day index (UTC-based) for a calendar date string — timezone-free math. */
function dayNumber(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

module.exports = {
  formatLocalDate,
  getTodayLocalDate,
  startOfLocalDay,
  addLocalDays,
  normalizeHabitDate,
  parseMonthKey,
  monthStart,
  nextMonthStart,
  dayNumber,
  DAY_MS,
};
