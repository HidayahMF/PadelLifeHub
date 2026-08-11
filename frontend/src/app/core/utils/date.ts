// Central timezone-safe date helpers for Asia/Jakarta (UTC+7).
// Daily tracking (habits, "today" comparisons) uses calendar-date strings
// "YYYY-MM-DD" built from LOCAL date parts — never raw UTC ISO slices, which
// can be off by one day across the UTC+7 boundary.

/** Format a Date as a local calendar date string: YYYY-MM-DD. */
export function formatDateToLocalYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's calendar date (local/WIB), e.g. "2026-08-11". */
export function getTodayLocalDate(): string {
  return formatDateToLocalYYYYMMDD(new Date());
}

/**
 * Normalize a habit completion value (Date, ISO string, or already normalized
 * "YYYY-MM-DD") to the local calendar date. Legacy UTC-midnight Dates map back
 * to the intended WIB day (2026-08-11T00:00:00.000Z = Aug 11, 07:00 WIB).
 */
export function normalizeHabitDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateToLocalYYYYMMDD(date);
}

/** Add days to a date (local). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Parse "YYYY-MM-DD" into a Date constructed from LOCAL parts (no UTC shift).
 * Use this when converting `<input type="date">` values for the API.
 */
export function localDateToDate(ymd: string | null | undefined): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "YYYY-MM" for a date (local). */
export function localMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
