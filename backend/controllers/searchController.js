// Global search — one efficient endpoint that searches across every
// user-scoped collection with a single parallel query batch.
// Every query is filtered by req.user._id so users can never see others' data.

const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const Note = require('../models/Note');
const Goal = require('../models/Goal');
const Habit = require('../models/Habit');
const Wishlist = require('../models/Wishlist');
const Need = require('../models/Need');
const Reminder = require('../models/Reminder');

const PER_COLLECTION_LIMIT = 5;

const globalSearch = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ query: '', results: {} });
    }

    const regex = { $regex: q, $options: 'i' };
    const userId = req.user._id;

    const activeFilter = { user: userId, archived: { $ne: true }, trashed: { $ne: true } };
    const [tasks, transactions, notes, goals, habits, wishlist, needs, reminders] =
      await Promise.all([
        Task.find({
          ...activeFilter,
          $or: [{ title: regex }, { description: regex }],
        })
          .sort({ pinned: -1, dueDate: 1 })
          .limit(PER_COLLECTION_LIMIT)
          .populate('category', 'name color icon'),
        Transaction.find({ user: userId, description: regex })
          .sort({ date: -1 })
          .limit(PER_COLLECTION_LIMIT)
          .populate('category', 'name color icon')
          .populate('account', 'name type'),
        Note.find({
          ...activeFilter,
          $or: [{ title: regex }, { content: regex }],
        })
          .sort({ updatedAt: -1 })
          .limit(PER_COLLECTION_LIMIT),
        Goal.find({
          ...activeFilter,
          $or: [{ title: regex }, { description: regex }],
        })
          .sort({ updatedAt: -1 })
          .limit(PER_COLLECTION_LIMIT),
        Habit.find({ user: userId, archived: { $ne: true }, name: regex })
          .sort({ updatedAt: -1 })
          .limit(PER_COLLECTION_LIMIT),
        Wishlist.find({
          ...activeFilter,
          name: regex,
        })
          .sort({ updatedAt: -1 })
          .limit(PER_COLLECTION_LIMIT),
        Need.find({ user: userId, name: regex })
          .sort({ updatedAt: -1 })
          .limit(PER_COLLECTION_LIMIT),
        Reminder.find({ user: userId, title: regex })
          .sort({ datetime: 1 })
          .limit(PER_COLLECTION_LIMIT),
      ]);

    res.json({
      query: q,
      results: {
        tasks,
        transactions,
        notes,
        goals,
        habits,
        wishlist,
        needs,
        reminders,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { globalSearch };
