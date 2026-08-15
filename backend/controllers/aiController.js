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
  buildDailyContext,
  buildHabitContext,
  buildGoalContext,
  buildGeneralContext,
  getUserLanguage,
} = require('../services/aiContext');

const MAX_MESSAGE_LENGTH = 4000;

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
    const prompt = `User question: "${req.body.message.trim()}"\n\nHere is the user's LifeHub data:\n${context}\n\nAnswer the question using only the data above. Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}. If the data does not contain what the question asks about, say so and suggest where to find it in the app.`;

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
    const context = await buildFinancialContext(req.user._id);
    const lang = await getUserLanguage(req.user._id);
    const prompt = `Here is the user's financial data:\n${context}\n\nAnalyze this person's finances. Provide a concise Markdown report with:\n1. A short summary of this month vs the previous month (income, expense, net).\n2. The largest spending categories this month.\n3. Potential problems (for example overspending against a budget, spending growth, low savings progress).\n4. 2-3 practical recommendations.\n\nRules: never invent numbers; base everything strictly on the data above. If the data is insufficient (for example no transactions yet), say that clearly and give general guidance instead. Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}.`;

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
    const prompt = `Here is the user's habit data:\n${context}\n\nAnalyze their habits and provide a concise Markdown report with:\n1. The most consistent habits.\n2. Any habits that seem to be slipping (compared to their own history).\n3. Simple patterns you notice in the data.\n4. Practical tips to protect current streaks.\n\nRules: base everything on the data above; if there are no habits or not enough history, say so. Do NOT make medical or psychological claims. Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}.`;

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
    const prompt = `Here is the user's goal data:\n${context}\n\nAnalyze their goals and provide a concise Markdown report with:\n1. The goal closest to its deadline.\n2. Goals at risk of missing the deadline (based on remaining amount and time left).\n3. A recommended priority order.\n4. One concrete next step per goal.\n\nRules: never invent numbers; if there are no active goals, say so and suggest how to set one up in LifeHub. Respond in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}.`;

    const reply = await generate(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    respondWithError(res, err);
  }
};

module.exports = { chat, financialInsight, dailyPlan, habitInsight, goalInsight };
