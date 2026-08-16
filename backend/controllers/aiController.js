// LifeHub AI controllers.
//
// Every endpoint:
//   - is reached through the `protect` auth middleware (req.user = JWT user)
//   - loads data for THAT user only, straight from MongoDB
//   - never accepts a userId from the request body
//   - returns a safe message on any failure (no API key, no raw Gemini errors)

const { generate, isConfigured } = require('../services/geminiService');
const {
  buildFinancialContext,
  getFinancialSnapshot,
  buildDailyContext,
  buildHabitContext,
  buildGoalContext,
  buildGeneralContext,
  getUserLanguage,
} = require('../services/aiContext');
const aiTransaction = require('../services/aiTransactionService');

const MAX_MESSAGE_LENGTH = 4000;

/** Plain IDR thousands formatting for numbers embedded in prompts. */
const formatNumber = (n) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(n) || 0);

/** Validate the free-form chat message. Returns an error string or null. */
function validateMessage(message) {
  if (typeof message !== 'string' || message.trim().length === 0) {
    return 'Message is required.';
  }
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return 'Message is too long.';
  }
  return null;
}

/** Safe response for an AI failure — technical detail only goes to the log. */
function respondWithError(res, err) {
  // Validation/ownership errors carry their own 4xx status + safe message.
  if (err?.statusCode && err.statusCode < 500) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  if (err?.code === 'AI_NOT_CONFIGURED') {
    return res.status(503).json({ success: false, message: 'AI service is not configured' });
  }
  if (err?.code === 'AI_TIMEOUT' || err?.code === 'AI_EMPTY_RESPONSE') {
    console.error('[ai] request failed:', err.message);
    return res.status(502).json({ success: false, message: 'AI service is temporarily unavailable.' });
  }
  console.error('[ai] request failed:', err?.message);
  return res.status(502).json({ success: false, message: 'AI service is temporarily unavailable.' });
}

const requireConfigured = (res) => {
  if (!isConfigured()) {
    res.status(503).json({ success: false, message: 'AI service is not configured' });
    return false;
  }
  return true;
};

/**
 * POST /api/ai/chat
 * Body: { message: string }
 */
const chat = async (req, res) => {
  try {
    const invalid = validateMessage(req.body?.message);
    if (invalid) {
      return res.status(400).json({ success: false, message: invalid });
    }
    if (!requireConfigured(res)) return;

    const userId = req.user._id;
    const context = await buildGeneralContext(userId);
    const lang = await getUserLanguage(userId);
    const prompt = `User question: "${req.body.message.trim()}"\n\nHere is the user's LifeHub data:\n${context}\n\nAnswer the question using only the data above. Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}. If the data does not contain what the question asks about, say so and suggest where to find it in the app.

Data rules:
- Category names, account names, descriptions, dates, and amounts are AUTHORITATIVE database values. NEVER rename, translate, normalize, merge, or broaden them. If the data says "Jajan", write "Jajan" — never "Food & Drinks". Spending totals by category and by account in the data above were calculated by the backend from the actual stored names; restate them exactly.
- When showing transactions, list each one as stored: date, description, amount, category, and account. Do not merge, reword, or change dates/amounts.
- If one transaction has no recorded account, say "account information is not recorded for this transaction" for that item only. Never invent an account name, and never claim the entire dataset lacks account info.`;

    const reply = await generate(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    respondWithError(res, err);
  }
};

/**
 * POST /api/ai/financial-insight
 * No body needed — data is pulled server-side for the authenticated user.
 */
const financialInsight = async (req, res) => {
  try {
    if (!requireConfigured(res)) return;
    const [context, snapshot] = await Promise.all([
      buildFinancialContext(req.user._id),
      getFinancialSnapshot(req.user._id),
    ]);
    const lang = await getUserLanguage(req.user._id);

    // The authoritative numbers are embedded verbatim so the model can never
    // produce a different balance/cash-flow than the backend calculated.
    const accountLines = snapshot.accounts.length
      ? snapshot.accounts.map((a) => `- ${a.name} | type: ${a.type || 'not recorded'} | ${formatNumber(a.balance)}`).join('\n')
      : '- none';
    const netWorthByTypeLines = snapshot.netWorth?.byType?.length
      ? snapshot.netWorth.byType.map((t) => `- ${t.type}: ${formatNumber(t.balance)}`).join('\n')
      : '- none';
    const categoryLines = snapshot.categorySpending.length
      ? snapshot.categorySpending.map((c) => `- ${c.category}: ${formatNumber(c.amount)}`).join('\n')
      : '- none';
    const accountSpendingLines = snapshot.accountSpending.length
      ? snapshot.accountSpending.map((a) => `- ${a.account}: ${formatNumber(a.amount)}`).join('\n')
      : '- none';
    const txLines = snapshot.recentTransactions.length
      ? snapshot.recentTransactions
          .map(
            (t) =>
              `- ${t.date} | ${t.type} | ${t.description} | ${formatNumber(t.amount)}` +
              (t.category ? ` | category: ${t.category}` : '') +
              (t.account ? ` | account: ${t.account}` : ' | account: not recorded')
          )
          .join('\n')
      : '- none';
    const authoritative = `Current month income: ${formatNumber(snapshot.currentMonthIncome)}
Current month expense: ${formatNumber(snapshot.currentMonthExpense)}
Previous month income: ${formatNumber(snapshot.previousMonthIncome)}
Previous month expense: ${formatNumber(snapshot.previousMonthExpense)}
Net cash flow (income - expense, transfers excluded): ${formatNumber(snapshot.netCashFlow)}
Total balance across all accounts (net worth): ${formatNumber(snapshot.totalBalance)}
Net worth breakdown (backend-calculated from the stored Account.type):
- Total: ${formatNumber(snapshot.netWorth?.total ?? snapshot.totalBalance)}
- Liquid (cash + bank + e-wallet): ${formatNumber(snapshot.netWorth?.liquid ?? snapshot.liquidAssets)}
- Investment: ${formatNumber(snapshot.netWorth?.investment ?? snapshot.investmentAssets)}
- By type:
${netWorthByTypeLines}
Account balances (name | type | balance):
${accountLines}
Spending by category (this month, backend-calculated):
${categoryLines}
Spending by account (this month, expense only, backend-calculated):
${accountSpendingLines}
Recent transactions (latest first, from the database):
${txLines}`;

    const prompt = `Here is the user's financial data:\n${context}\n\nSYSTEM-CALCULATED FIGURES (the ONLY source of truth — restate these exact numbers, never compute your own):\n${authoritative}\n\nAnalyze this person's finances and write a concise Markdown report with EXACTLY three sections, in this order:

**FACTS**
- This month vs previous month: income, expense, net cash flow — using the exact system-calculated figures.
- Largest spending categories this month.
- Current account balance, liquid assets, and investment assets.

**INSIGHTS**
- What the numbers suggest (e.g. spending growth, savings progress, where money tends to go).
- Potential problems — only if the data actually shows one (overspending against a budget, spending growth, low savings progress). If nothing is wrong, say so.

**RECOMMENDATIONS**
- 2-3 practical, specific actions based on the actual data (if the user already has budgets or savings goals, do not suggest creating them from scratch).

Important rules:
- FACTS must come only from the data above. INSIGHTS are interpretations of those facts; RECOMMENDATIONS are suggestions — never present a suggestion as a fact.
- Category names, account names, descriptions, dates, and amounts are AUTHORITATIVE database values. NEVER rename, translate, normalize, merge, or broaden them. If the data says "Jajan", write "Jajan" — never "Food & Drinks" or any other name. The category and account totals above were calculated by the backend from the actual stored names; restate them exactly.
- When listing transactions, show each stored value exactly as given: date, description, amount, category, and account. Do not merge transactions, change dates, change amounts, or infer an account that is not recorded.
- If an individual transaction has no recorded account, say "account information is not recorded for this transaction" for that transaction only — do not claim the whole dataset lacks account info, and never invent an account name.
- Net cash flow (this month's income minus expense) is NOT the same as the total account balance. They can differ because money can come from previous periods. A month with zero income and positive spending is NOT necessarily a deficit — the account balance may still be positive.
- Transfers between the user's own accounts are NOT income and NOT expense, and must never appear in the cash-flow math.
- Never state the balance is Rp0 or negative when the system-calculated total balance is positive.
- Never invent numbers; base everything strictly on the data above. If the data is insufficient (for example no transactions yet), say that clearly in the relevant section and give general guidance instead.
- Never present this as professional financial advice.

Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}.`;

    const reply = await generate(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    respondWithError(res, err);
  }
};

/**
 * POST /api/ai/daily-plan
 * AI recommends a schedule only — it never writes to the database.
 */
const dailyPlan = async (req, res) => {
  try {
    if (!requireConfigured(res)) return;
    const context = await buildDailyContext(req.user._id);
    const lang = await getUserLanguage(req.user._id);
    const prompt = `Here is the user's day:\n${context}\n\nCreate a realistic daily schedule recommendation using ONLY these tasks, habits, goals, and reminders. Group it as:\n- **Morning:** ...\n- **Afternoon:** ...\n- **Evening:** ...\n\nPrioritize overdue and high-priority tasks, leave room for habits, and keep it to a manageable number of items. If the day is empty, say so and suggest a light plan. Never invent tasks that are not listed. Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}.`;

    const reply = await generate(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    respondWithError(res, err);
  }
};

/**
 * POST /api/ai/habit-insight
 */
const habitInsight = async (req, res) => {
  try {
    if (!requireConfigured(res)) return;
    const context = await buildHabitContext(req.user._id);
    const lang = await getUserLanguage(req.user._id);
    const prompt = `Here is the user's habit data:\n${context}\n\nAnalyze their habits and write a concise Markdown report with EXACTLY three sections, in this order:

**FACTS**
- Which habits are tracked, their current streaks, and completion counts (from the data above).

**INSIGHTS**
- The most consistent habits and any that seem to be slipping (compared to their own history).
- Simple patterns you notice in the data.

**RECOMMENDATIONS**
- Practical tips to protect current streaks and rebuild slipping ones.

Rules: FACTS must come only from the data above; INSIGHTS are interpretations; RECOMMENDATIONS are suggestions. If there are no habits or not enough history, say so in the relevant section. Do NOT make medical or psychological claims. Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}.`;

    const reply = await generate(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    respondWithError(res, err);
  }
};

/**
 * POST /api/ai/goal-insight
 */
const goalInsight = async (req, res) => {
  try {
    if (!requireConfigured(res)) return;
    const context = await buildGoalContext(req.user._id);
    const lang = await getUserLanguage(req.user._id);
    const prompt = `Here is the user's goal data:\n${context}\n\nAnalyze their goals and write a concise Markdown report with EXACTLY three sections, in this order:

**FACTS**
- Each active goal, its progress, remaining amount (if any), and deadline (from the data above).

**INSIGHTS**
- The goal closest to its deadline and any goals at risk of missing it (based on remaining amount and time left).
- A recommended priority order.

**RECOMMENDATIONS**
- One concrete next step per goal.

Rules: FACTS must come only from the data above; INSIGHTS are interpretations; RECOMMENDATIONS are suggestions. Never invent numbers; if there are no active goals, say so in the relevant section and suggest how to set one up in LifeHub. Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}.`;

    const reply = await generate(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    respondWithError(res, err);
  }
};

/**
 * POST /api/ai/parse-transaction
 * Body: { message: string }
 * READ ONLY — extracts a transaction draft from natural language without
 * ever writing to the database. Only the confirm endpoint writes.
 */
const parseTransaction = async (req, res) => {
  try {
    const invalid = validateMessage(req.body?.message);
    if (invalid) {
      return res.status(400).json({ success: false, message: invalid });
    }
    if (!requireConfigured(res)) return;

    const result = await aiTransaction.parseTransaction(
      req.user._id,
      req.body.message.trim()
    );
    res.json(result);
  } catch (err) {
    respondWithError(res, err);
  }
};

/**
 * POST /api/ai/create-transaction
 * Body: { draft: {...} }
 * THE WRITE PATH. Re-validates the draft server-side (never trusts the
 * client) and creates the transaction via the shared transaction service.
 */
const createTransaction = async (req, res) => {
  try {
    if (!requireConfigured(res)) return;
    const transaction = await aiTransaction.createTransaction(
      req.user._id,
      req.body?.draft
    );
    res.json({
      success: true,
      created: true,
      transaction,
      reply: 'Transaksi berhasil disimpan.',
    });
  } catch (err) {
    respondWithError(res, err);
  }
};

module.exports = {
  chat,
  financialInsight,
  dailyPlan,
  habitInsight,
  goalInsight,
  parseTransaction,
  createTransaction,
};
