// AI context builders — the data-minimization layer of LifeHub AI.
//
// Every builder queries MongoDB scoped to the authenticated user (`userId`
// comes from the JWT, never from the client) and returns a compact plain-text
// summary containing ONLY what the model needs to answer:
//   - feature names and amounts
//   - never passwords, JWT, tokens, googleId, API keys, emails, or raw
//     MongoDB documents / internal ids
//
// This keeps the model grounded in real data without ever shipping private
// fields to a third party.

const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const Habit = require('../models/Habit');
const Goal = require('../models/Goal');
const Account = require('../models/Account');
const Budget = require('../models/Budget');
const Reminder = require('../models/Reminder');
const Setting = require('../models/Setting');
const FocusSession = require('../models/FocusSession');
const { startOfLocalDay, addLocalDays, getTodayLocalDate } = require('../utils/date');

// ── In-memory user-scoped cache ────────────────────────────────────────────
// Lightweight TTL cache to avoid redundant DB-heavy context builds within
// short windows. Key format: `${userId}:${contextType}`.
// NOT shared across users. Entries expire after TTL_MS.

const CACHE_TTL_MS = 60_000; // 60 seconds — short enough to stay fresh
const _cache = new Map();

function cacheKey(userId, type) {
  return `${String(userId)}:${type}`;
}

function cacheGet(userId, type) {
  const entry = _cache.get(cacheKey(userId, type));
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(cacheKey(userId, type));
    return undefined;
  }
  return entry.value;
}

function cacheSet(userId, type, value) {
  // Cap cache size at 500 entries to prevent memory leaks
  if (_cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of _cache) {
      if (now > v.expiresAt) _cache.delete(k);
    }
    // If still over 500, clear oldest half
    if (_cache.size > 500) {
      const keys = [..._cache.keys()];
      for (let i = 0; i < Math.ceil(keys.length / 2); i++) {
        _cache.delete(keys[i]);
      }
    }
  }
  _cache.set(cacheKey(userId, type), { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateUserCache(userId) {
  const prefix = `${String(userId)}:`;
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const fmt = (n) => IDR.format(Number(n) || 0);

/** YYYY-MM for the current month, used to match Budget.month. */
function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function fmtDate(d) {
  if (!d) return 'no date';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(d));
}

/**
 * Authoritative net-worth breakdown computed from the stored Account
 * documents. Account.type is the SOURCE OF TRUTH — never inferred from the
 * account name.
 *
 *   total      = sum of all stored balances
 *   liquid     = total minus investment accounts (cash + bank + e-wallet)
 *   investment = sum of investment accounts
 *   byType     = balance grouped by the stored Account.type value
 */
function computeNetWorth(accounts) {
  const byType = new Map();
  let total = 0;
  for (const a of accounts) {
    const balance = Number(a.balance) || 0;
    total += balance;
    const type = a.type && String(a.type).trim() ? String(a.type) : 'unknown';
    byType.set(type, (byType.get(type) || 0) + balance);
  }
  const rows = [...byType.entries()]
    .map(([type, balance]) => ({ type, balance }))
    .sort((x, y) => y.balance - x.balance);
  const investment = rows.find((r) => r.type === 'investment')?.balance || 0;
  return { total, liquid: total - investment, investment, byType: rows };
}

/**
 * Load the raw financial data for a user (current vs previous month income,
 * expense, top spending categories, budgets, savings goals, the user's own
 * accounts and their stored balances). Every query is scoped to `userId`.
 *
 * Account balances come straight from the Account collection (the same source
 * of truth as the Finance page / dashboard) — never recomputed from
 * transaction history, and never summed as an aggregate array that turns into
 * NaN. Returns raw numbers so the controller can both format the context AND
 * embed the exact figures in the AI prompt.
 */
async function loadFinancialData(userId) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    monthIncome,
    monthExpense,
    prevIncome,
    prevExpense,
    categorySpending,
    accountSpending,
    budgets,
    savingsGoals,
    accounts,
    recent,
  ] = await Promise.all([
    sumTx(userId, 'income', monthStart, nextMonth),
    sumTx(userId, 'expense', monthStart, nextMonth),
    sumTx(userId, 'income', prevMonthStart, monthStart),
    sumTx(userId, 'expense', prevMonthStart, monthStart),
    Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: monthStart, $lt: nextMonth },
          category: { $ne: null },
        },
      },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'cat' } },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$category', name: { $first: '$cat.name' }, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),
    // Spending per account, grouped by the REAL account name from the Account
    // collection — backend-calculated so the AI never invents account names.
    Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: monthStart, $lt: nextMonth },
          account: { $ne: null },
        },
      },
      { $lookup: { from: 'accounts', localField: 'account', foreignField: '_id', as: 'acc' } },
      { $unwind: { path: '$acc', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$account', name: { $first: '$acc.name' }, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),
    Budget.find({ user: userId, month: monthKey(now) }).populate('category', 'name'),
    Goal.find({ user: userId, kind: 'savings', completed: false, archived: { $ne: true } }).sort({
      deadline: 1,
    }),
    Account.find({ user: userId }).select('name type balance currency').sort({ name: 1 }),
    Transaction.find({ user: userId })
      .sort({ date: -1 })
      .limit(10)
      .populate('category', 'name')
      .populate('account', 'name'),
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const netWorth = computeNetWorth(accounts);

  return {
    monthIncome,
    monthExpense,
    prevIncome,
    prevExpense,
    netCashFlow: monthIncome - monthExpense,
    totalBalance,
    netWorth,
    categorySpending,
    accountSpending,
    budgets,
    savingsGoals,
    accounts,
    recent,
  };
}

/**
 * Compact financial summary: this month vs last month income/expense,
 * top spending categories, budgets, savings goals, balances, and a few
 * recent transactions. No transaction descriptions over ~40 chars are kept.
 */
async function buildFinancialContext(userId) {
  const cached = cacheGet(userId, 'financial');
  if (cached) {
    console.log('[AI] cache hit — financial context');
    return cached;
  }
  console.log('[AI] cache miss — financial context');
  const {
    monthIncome,
    monthExpense,
    prevIncome,
    prevExpense,
    netCashFlow,
    totalBalance,
    netWorth,
    categorySpending,
    accountSpending,
    budgets,
    savingsGoals,
    accounts,
    recent,
  } = await loadFinancialData(userId);

  const lines = [];
  lines.push('Monthly income (this month): ' + fmt(monthIncome));
  lines.push('Monthly expense (this month): ' + fmt(monthExpense));
  lines.push('Net cash flow this month (income - expense): ' + fmt(netCashFlow));
  lines.push('Monthly income (previous month): ' + fmt(prevIncome));
  lines.push('Monthly expense (previous month): ' + fmt(prevExpense));
  lines.push('Total balance across accounts: ' + fmt(totalBalance));
  lines.push('Transfers between the user\'s own accounts are excluded from income, expense and net cash flow.');

  if (accounts.length > 0) {
    lines.push('Account balances (name | type | balance):');
    for (const a of accounts) {
      lines.push(`- ${a.name} | ${a.type || 'not recorded'} | ${fmt(a.balance)}`);
    }
  }

  if (netWorth.total > 0) {
    lines.push('Net worth (from stored account types, backend-calculated):');
    lines.push(`- Total: ${fmt(netWorth.total)}`);
    lines.push(`- Liquid (cash + bank + e-wallet): ${fmt(netWorth.liquid)}`);
    lines.push(`- Investment: ${fmt(netWorth.investment)}`);
    if (netWorth.byType.length > 0) {
      lines.push('- By type:');
      for (const t of netWorth.byType) {
        lines.push(`  - ${t.type}: ${fmt(t.balance)}`);
      }
    }
  }

  if (categorySpending.length > 0) {
    lines.push('Spending by category (this month, backend-calculated from the actual category names):');
    for (const c of categorySpending) {
      lines.push(`- ${c.name || 'Uncategorized'}: ${fmt(c.total)}`);
    }
  } else {
    lines.push('Spending by category: none this month');
  }

  if (accountSpending.length > 0) {
    lines.push('Spending by account (this month, expense only):');
    for (const a of accountSpending) {
      lines.push(`- ${a.name || 'Unknown account'}: ${fmt(a.total)}`);
    }
  }

  if (budgets.length > 0) {
    lines.push('Budgets (this month):');
    for (const b of budgets) {
      const name = b.category?.name || 'Overall';
      const remaining = Math.max(0, (b.amount || 0) - (b.spent || 0));
      lines.push(`- ${name}: limit ${fmt(b.amount)}, spent ${fmt(b.spent)}, remaining ${fmt(remaining)}`);
    }
  } else {
    lines.push('Budgets: none set this month');
  }

  if (savingsGoals.length > 0) {
    lines.push('Savings goals:');
    for (const g of savingsGoals) {
      const remaining = Math.max(0, (g.target || 0) - (g.progress || 0));
      lines.push(
        `- ${g.title}: target ${fmt(g.target)}, saved ${fmt(g.progress)}, remaining ${fmt(remaining)}` +
          (g.deadline ? `, deadline ${fmtDate(g.deadline)}` : '')
      );
    }
  } else {
    lines.push('Savings goals: none');
  }

  if (recent.length > 0) {
    lines.push('Recent transactions (latest first):');
    for (const t of recent) {
      const desc = (t.description || t.category?.name || 'transaction').slice(0, 40);
      const cat = t.category?.name ?? null;
      const acct = t.account?.name ?? null;
      lines.push(
        `- ${fmtDate(t.date)} | ${t.type} | ${desc} | ${fmt(t.amount)}` +
          (cat ? ` | category: ${cat}` : '') +
          (acct ? ` | account: ${acct}` : ' | account: not recorded')
      );
    }
  }

  const result = lines.join('\n');
  cacheSet(userId, 'financial', result);
  return result;
}

/** Daily planning context: focus tasks, overdue, habits, goals, reminders. */
async function buildDailyContext(userId) {
  const cached = cacheGet(userId, 'daily');
  if (cached) {
    console.log('[AI] cache hit — daily context');
    return cached;
  }
  console.log('[AI] cache miss — daily context');
  const now = new Date();
  const today = startOfLocalDay(now);
  const tomorrow = addLocalDays(today, 1);
  const todayStr = getTodayLocalDate();

  const [focus, overdue, habits, goals, reminders, upcomingTasks] = await Promise.all([
    Task.find({
      user: userId,
      dueDate: { $gte: today, $lt: tomorrow },
      status: { $ne: 'completed' },
      archived: { $ne: true },
    })
      .sort({ pinned: -1, dueDate: 1 })
      .limit(10),
    Task.find({
      user: userId,
      dueDate: { $lt: today },
      status: { $ne: 'completed' },
      archived: { $ne: true },
    })
      .sort({ dueDate: 1 })
      .limit(10),
    Habit.find({ user: userId, archived: { $ne: true } }).sort({ createdAt: 1 }),
    Goal.find({ user: userId, completed: false, archived: { $ne: true } }).sort({ deadline: 1 }).limit(8),
    Reminder.find({ user: userId, datetime: { $gte: now } }).sort({ datetime: 1 }).limit(6),
    Task.find({
      user: userId,
      dueDate: { $gte: tomorrow },
      status: { $ne: 'completed' },
      archived: { $ne: true },
    })
      .sort({ dueDate: 1 })
      .limit(6),
  ]);

  const lines = [];

  if (focus.length > 0) {
    lines.push(`Tasks due today (${focus.length}):`);
    for (const t of focus) {
      lines.push(`- ${t.title}${t.priority === 'high' ? ' [high priority]' : ''}`);
    }
  } else {
    lines.push('Tasks due today: none');
  }

  if (overdue.length > 0) {
    lines.push('Overdue tasks:');
    for (const t of overdue) {
      lines.push(`- ${t.title} (was due ${fmtDate(t.dueDate)})`);
    }
  } else {
    lines.push('Overdue tasks: none');
  }

  if (upcomingTasks.length > 0) {
    lines.push('Upcoming tasks (next few days):');
    for (const t of upcomingTasks) {
      lines.push(`- ${t.title} (due ${fmtDate(t.dueDate)})`);
    }
  }

  if (habits.length > 0) {
    lines.push('Habits:');
    for (const h of habits) {
      const doneToday = (h.completedDates || []).includes(todayStr);
      lines.push(`- ${h.name}: streak ${h.streak}${doneToday ? ', done today' : ', not done today'}`);
    }
  } else {
    lines.push('Habits: none');
  }

  if (goals.length > 0) {
    lines.push('Active goals:');
    for (const g of goals) {
      const pct = g.target ? Math.round((g.progress / g.target) * 100) : g.progress;
      lines.push(`- ${g.title}: ${pct}%${g.deadline ? `, deadline ${fmtDate(g.deadline)}` : ''}`);
    }
  }

  if (reminders.length > 0) {
    lines.push('Upcoming reminders:');
    for (const r of reminders) {
      lines.push(`- ${r.title} (${fmtDate(r.datetime)})`);
    }
  }

  const result = lines.join('\n');
  cacheSet(userId, 'daily', result);
  return result;
}

/** Habit analysis context: streaks, best streaks, recent completion history. */
async function buildHabitContext(userId) {
  const habits = await Habit.find({ user: userId, archived: { $ne: true } }).sort({ createdAt: 1 });
  const todayStr = getTodayLocalDate();
  const lines = [];

  if (habits.length === 0) {
    return 'Habits: none tracked yet.';
  }

  lines.push(`Habits tracked (${habits.length}):`);
  for (const h of habits) {
    const done = h.completedDates || [];
    const recent14 = done.filter((d) => d >= getDayOffset(-13)).sort();
    const doneToday = done.includes(todayStr);
    lines.push(
      `- ${h.name}: frequency ${h.frequency}, current streak ${h.streak}, best streak ${h.bestStreak}, ` +
        `completed ${done.length} times total, last 14 days: ${recent14.length} completions` +
        (doneToday ? ', done today' : ', not done today')
    );
  }
  return lines.join('\n');
}

/** Goal analysis context: targets, progress, deadlines, required pace. */
async function buildGoalContext(userId) {
  const goals = await Goal.find({ user: userId, completed: false, archived: { $ne: true } }).sort({
    deadline: 1,
  });
  const lines = [];

  if (goals.length === 0) {
    return 'Active goals: none.';
  }

  lines.push(`Active goals (${goals.length}):`);
  const now = new Date();
  for (const g of goals) {
    const remaining = g.target ? Math.max(0, g.target - g.progress) : null;
    const pct = g.target ? Math.round((g.progress / g.target) * 100) : g.progress;
    let pace = '';
    if (g.deadline && remaining !== null && remaining > 0) {
      const monthsLeft = Math.max(
        0,
        (g.deadline.getFullYear() - now.getFullYear()) * 12 +
          (g.deadline.getMonth() - now.getMonth())
      );
      const perMonth = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
      pace = `, needed per month ~${fmt(perMonth)} over ${monthsLeft} month(s)`;
    }
    lines.push(
      `- ${g.title}: kind ${g.kind}, progress ${pct}%` +
        (remaining !== null ? `, remaining ${fmt(remaining)}` : '') +
        (g.deadline ? `, deadline ${fmtDate(g.deadline)}` : '') +
        pace
    );
  }
  return lines.join('\n');
}

/** Monday (local WIB) of the week containing `date`. */
function weekStartOf(date = new Date()) {
  const d = startOfLocalDay(date);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return d;
}

/** Format a duration in seconds as "Xh Ym" (or "Ym" under an hour). */
function fmtDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Total focus time (seconds) for sessions starting in [start, end). */
async function focusSeconds(userId, start, end) {
  const [row] = await FocusSession.aggregate([
    { $match: { user: userId, startTime: { $gte: start, $lt: end } } },
    { $group: { _id: null, duration: { $sum: '$duration' } } },
  ]);
  return row?.duration ?? 0;
}

/** Focus-time context: how much the user focused today / this week / this month. */
async function buildFocusContext(userId) {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const weekStart = weekStartOf(now);
  const weekEnd = addLocalDays(weekStart, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [today, week, month] = await Promise.all([
    focusSeconds(userId, todayStart, addLocalDays(todayStart, 1)),
    focusSeconds(userId, weekStart, weekEnd),
    focusSeconds(userId, monthStart, nextMonth),
  ]);

  return (
    'Focus time (from recorded Pomodoro sessions):\n' +
    `- Today: ${fmtDuration(today)}\n` +
    `- This week: ${fmtDuration(week)}\n` +
    `- This month: ${fmtDuration(month)}`
  );
}

/**
 * Compact general overview used by the free-form chat: today's focus,
 * finance month summary, habits, goals, and focus time — enough to answer
 * most questions without shipping the whole database.
 */
async function buildGeneralContext(userId) {
  const [financial, daily, focus] = await Promise.all([
    buildFinancialContext(userId),
    buildDailyContext(userId),
    buildFocusContext(userId),
  ]);
  return `--- FINANCE ---\n${financial}\n\n--- TODAY ---\n${daily}\n\n--- FOCUS ---\n${focus}`;
}

/** Preferred response language from the user's settings ('id' or 'en'). */
async function getUserLanguage(userId) {
  try {
    const setting = await Setting.findOne({ user: userId });
    return setting?.language === 'id' ? 'id' : 'en';
  } catch {
    return 'en';
  }
}

async function sumTx(userId, type, start, end) {
  const [res] = await Transaction.aggregate([
    { $match: { user: userId, type, date: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return res?.total || 0;
}

function getDayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  buildFinancialContext,
  getFinancialSnapshot,
  buildDailyContext,
  buildHabitContext,
  buildGoalContext,
  buildGeneralContext,
  buildFocusContext,
  getUserLanguage,
  computeNetWorth,
  _cacheUtils: { cacheGet, cacheSet, invalidateUserCache },
};

/**
 * Authoritative financial figures for the current user — calculated by the
 * backend from the database. These exact numbers are embedded in the AI prompt
 * so the model restates them instead of computing (or inventing) its own.
 * Never derived from the model's output.
 */
async function getFinancialSnapshot(userId) {
  const cached = cacheGet(userId, 'snapshot');
  if (cached) {
    console.log('[AI] cache hit — financial snapshot');
    return cached;
  }
  console.log('[AI] cache miss — financial snapshot');
  const data = await loadFinancialData(userId);
  const snapshot = {
    currentMonthIncome: data.monthIncome,
    currentMonthExpense: data.monthExpense,
    previousMonthIncome: data.prevIncome,
    previousMonthExpense: data.prevExpense,
    netCashFlow: data.netCashFlow,
    totalBalance: data.totalBalance,
    // Liquid = cash + bank + e-wallet; investment tracked separately. Both the
    // breakdown and the totals come from the shared computeNetWorth helper, so
    // every AI feature reports the exact same numbers.
    liquidAssets: data.netWorth.liquid,
    investmentAssets: data.netWorth.investment,
    netWorth: data.netWorth,
    accounts: data.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      balance: Number(a.balance) || 0,
    })),
    // Backend-calculated totals grouped by the REAL database names. The AI must
    // restate these exactly — never rename a category or account.
    categorySpending: data.categorySpending.map((c) => ({
      category: c.name ?? 'Uncategorized',
      amount: Number(c.total) || 0,
    })),
    accountSpending: data.accountSpending.map((a) => ({
      account: a.name ?? 'Unknown account',
      amount: Number(a.total) || 0,
    })),
    // Raw, authoritative transaction list — dates, descriptions, amounts,
    // types, categories and account names come straight from the database.
    recentTransactions: data.recent.map((t) => ({
      date: fmtDate(t.date),
      description: (t.description || t.category?.name || 'transaction').slice(0, 40),
      amount: Number(t.amount) || 0,
      type: t.type,
      category: t.category?.name ?? null,
      account: t.account?.name ?? null,
    })),
  };
  cacheSet(userId, 'snapshot', snapshot);
  return snapshot;
}
