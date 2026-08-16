// Focus Session (Pomodoro) controller — persistent focus sessions.
//
// Every endpoint is reached through the `protect` auth middleware, so the
// user id always comes from the JWT (req.user._id), never from the client.
//
// - POST /api/focus-sessions       — record a completed/interrupted session
//                                    (idempotent per user + clientId)
// - GET  /api/focus-sessions       — recent sessions (optional ?status=)
// - GET  /api/focus-sessions/stats — focus time today / this week / this month
//
// Statistics include both completed AND interrupted sessions, because an
// interrupted run still represents real focus time (partial durations are
// stored as-is).

const FocusSession = require('../models/FocusSession');
const { startOfLocalDay, addLocalDays } = require('../utils/date');

// Sanity bounds for a single focus run: 1 second .. 8 hours.
const MIN_DURATION = 1;
const MAX_DURATION = 8 * 60 * 60;

/** Monday (local WIB) of the week containing `date`. */
function weekStartOf(date = new Date()) {
  const d = startOfLocalDay(date);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return d;
}

/** Validate the create body. Returns a normalized doc or throws a 400 error. */
function validateBody(body) {
  const errors = [];
  const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : '';
  if (!clientId || clientId.length > 100) errors.push('clientId is required');
  if (body?.duration === undefined) {
    errors.push('duration is required');
  }
  const duration = Number(body?.duration);
  if (!Number.isFinite(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
    errors.push(`duration must be between ${MIN_DURATION} and ${MAX_DURATION} seconds`);
  }
  const startTime = body?.startTime ? new Date(body.startTime) : null;
  if (!startTime || Number.isNaN(startTime.getTime())) errors.push('startTime must be a valid date');
  else if (startTime.getTime() > Date.now() + 120_000) {
    errors.push('startTime cannot be in the future');
  }
  let endTime = null;
  if (body?.endTime !== undefined && body.endTime !== null) {
    endTime = new Date(body.endTime);
    if (Number.isNaN(endTime.getTime())) errors.push('endTime must be a valid date');
    else if (startTime && endTime < startTime) errors.push('endTime cannot be before startTime');
  }
  const status = body?.status === 'interrupted' ? 'interrupted' : 'completed';
  let taskId = null;
  if (body?.taskId) {
    if (!/^[0-9a-fA-F]{24}$/.test(body.taskId)) errors.push('taskId must be a valid id');
    else taskId = body.taskId;
  }
  if (errors.length > 0) {
    const err = new Error(errors.join('; '));
    err.statusCode = 400;
    throw err;
  }
  return { clientId, startTime, endTime, duration, status, taskId };
}

/**
 * POST /api/focus-sessions
 * Records a focus session. Idempotent: re-sending the same clientId returns
 * the already-stored session instead of creating a duplicate (the unique
 * index on { user, clientId } also closes the race between two concurrent
 * identical requests).
 */
const createSession = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const doc = validateBody(req.body);

    const existing = await FocusSession.findOne({ user: userId, clientId: doc.clientId });
    if (existing) return res.json(existing);

    try {
      const session = await FocusSession.create({ user: userId, ...doc });
      return res.status(201).json(session);
    } catch (err) {
      if (err?.code === 11000) {
        const raced = await FocusSession.findOne({ user: userId, clientId: doc.clientId });
        return res.json(raced);
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

/** GET /api/focus-sessions — recent sessions for the authenticated user. */
const listSessions = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.status === 'completed' || req.query.status === 'interrupted') {
      filter.status = req.query.status;
    }
    const sessions = await FocusSession.find(filter).sort({ startTime: -1 }).limit(50);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
};

/** Aggregate { count, duration } for sessions starting in [start, end). */
async function focusTotals(userId, start, end) {
  const [row] = await FocusSession.aggregate([
    { $match: { user: userId, startTime: { $gte: start, $lt: end } } },
    { $group: { _id: null, count: { $sum: 1 }, duration: { $sum: '$duration' } } },
  ]);
  return { count: row?.count ?? 0, duration: row?.duration ?? 0 };
}

/** GET /api/focus-sessions/stats — focus time today / this week / this month. */
const getStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const weekStart = weekStartOf(now);
    const weekEnd = addLocalDays(weekStart, 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [today, week, month] = await Promise.all([
      focusTotals(userId, todayStart, addLocalDays(todayStart, 1)),
      focusTotals(userId, weekStart, weekEnd),
      focusTotals(userId, monthStart, nextMonth),
    ]);

    res.json({ today, week, month });
  } catch (err) {
    next(err);
  }
};

module.exports = { createSession, listSessions, getStats, weekStartOf, focusTotals };
