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

/**
 * Convert a naive "YYYY-MM-DDTHH:mm" value (from <input type="datetime-local">)
 * into the UTC ISO instant representing the same wall-clock time in
 * Asia/Jakarta (WIB, UTC+7). Without this, a UTC server parses the naive
 * string as UTC and the reminder shifts by +7h when displayed back in WIB.
 */
export function wibDateTimeToUtcISO(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 7, mi)).toISOString();
}

/**
 * Inverse of wibDateTimeToUtcISO: format a stored date/ISO instant as a naive
 * "YYYY-MM-DDTHH:mm" value for <input type="datetime-local">, in WIB.
 */
export function utcIsoToWibDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const wib = new Date(date.getTime() + 7 * 3_600_000);
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}T${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`;
}

/** Format a stored date/ISO instant as a "YYYY-MM-DD" string in WIB. */
export function utcIsoToWibDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const wib = new Date(date.getTime() + 7 * 3_600_000);
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}`;
}
