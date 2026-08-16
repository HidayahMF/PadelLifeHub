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
      { $limit: 6 },
    ]),
    Budget.find({ user: userId, month: monthKey(now) }).populate('category', 'name'),
    Goal.find({ user: userId, kind: 'savings', completed: false, archived: { $ne: true } }).sort({
      deadline: 1,
    }),
    Account.find({ user: userId }).select('name type balance currency').sort({ name: 1 }),
    Transaction.find({ user: userId }).sort({ date: -1 }).limit(5).populate('category', 'name'),
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  return {
    monthIncome,
    monthExpense,
    prevIncome,
    prevExpense,
    netCashFlow: monthIncome - monthExpense,
    totalBalance,
    categorySpending,
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
  const {
    monthIncome,
    monthExpense,
    prevIncome,
    prevExpense,
    netCashFlow,
    totalBalance,
    categorySpending,
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
    lines.push('Account balances:');
    for (const a of accounts) {
      lines.push(`- ${a.name}: ${fmt(a.balance)}`);
    }
  }

  if (categorySpending.length > 0) {
    lines.push('Top spending categories (this month):');
    for (const c of categorySpending) {
      lines.push(`- ${c.name || 'Uncategorized'}: ${fmt(c.total)}`);
    }
  } else {
    lines.push('Top spending categories: none this month');
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
    lines.push('Recent transactions (last 5):');
    for (const t of recent) {
      const desc = (t.description || t.category?.name || 'transaction').slice(0, 40);
      lines.push(`- ${t.type}: ${desc} — ${fmt(t.amount)} (${fmtDate(t.date)})`);
    }
  }

  return lines.join('\n');
}

/** Daily planning context: focus tasks, overdue, habits, goals, reminders. */
async function buildDailyContext(userId) {
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

  return lines.join('\n');
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
};

/**
 * Authoritative financial figures for the current user — calculated by the
 * backend from the database. These exact numbers are embedded in the AI prompt
 * so the model restates them instead of computing (or inventing) its own.
 * Never derived from the model's output.
 */
async function getFinancialSnapshot(userId) {
  const data = await loadFinancialData(userId);
  // Liquid = cash + bank + e-wallet; investment is tracked separately so the
  // AI never conflates the whole balance with cash.
  let liquidAssets = 0;
  let investmentAssets = 0;
  for (const a of data.accounts) {
    const balance = Number(a.balance) || 0;
    if (a.type === 'investment') investmentAssets += balance;
    else liquidAssets += balance;
  }
  return {
    currentMonthIncome: data.monthIncome,
    currentMonthExpense: data.monthExpense,
    previousMonthIncome: data.prevIncome,
    previousMonthExpense: data.prevExpense,
    netCashFlow: data.netCashFlow,
    totalBalance: data.totalBalance,
    liquidAssets,
    investmentAssets,
    accounts: data.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      balance: Number(a.balance) || 0,
    })),
  };
}
