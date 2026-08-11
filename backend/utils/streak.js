const { normalizeHabitDate, dayNumber, getTodayLocalDate } = require('./date');

/**
 * Current streak for a list of completed calendar dates (YYYY-MM-DD).
 * Rule: consecutive days ending at "today" (if completed today) or at
 * "yesterday" (so the streak is not broken before you complete today).
 * Duplicates are ignored; dates are normalized to calendar date strings.
 */
function calcStreak(completedDates) {
  const set = new Set(
    (completedDates || [])
      .map((d) => normalizeHabitDate(d))
      .filter((d) => d !== null)
  );
  if (set.size === 0) return 0;

  const todayKey = getTodayLocalDate();
  let cursor = dayNumber(todayKey);
  if (!set.has(todayKey)) {
    cursor -= 1; // today not done yet — count from yesterday
  }

  let streak = 0;
  while (set.has(intFromDayNumber(cursor))) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

/** Longest consecutive run ever achieved in the given completed dates. */
function calcBestStreak(completedDates) {
  const set = new Set(
    (completedDates || [])
      .map((d) => normalizeHabitDate(d))
      .filter((d) => d !== null)
      .map((d) => dayNumber(d))
  );
  if (set.size === 0) return 0;

  const nums = [...set].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

function intFromDayNumber(n) {
  const date = new Date(n * 86_400_000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { calcStreak, calcBestStreak };
