const Habit = require('../models/Habit');
const { getTodayLocalDate, normalizeHabitDate } = require('../utils/date');
const { calcStreak, calcBestStreak } = require('../utils/streak');

/** Normalize a habit's completion dates + refresh streak fields in place. */
function refreshStreak(habit) {
  const dates = (habit.completedDates || [])
    .map((d) => normalizeHabitDate(d))
    .filter((d) => d !== null);
  habit.completedDates = [...new Set(dates)].sort();
  habit.streak = calcStreak(habit.completedDates);
  habit.bestStreak = Math.max(Number(habit.bestStreak) || 0, calcBestStreak(habit.completedDates));
  return habit;
}

const getHabits = async (req, res, next) => {
  try {
    const habits = await Habit.find({ user: req.user._id }).sort({ createdAt: 1 });
    for (const habit of habits) {
      // Migrate legacy Date-based entries to calendar date strings on read.
      if (habit.completedDates.some((d) => typeof d !== 'string')) {
        refreshStreak(habit);
        await habit.save();
      }
    }
    res.json(habits);
  } catch (err) {
    next(err);
  }
};

const createHabit = async (req, res, next) => {
  try {
    const habit = new Habit({ user: req.user._id, ...req.body });
    refreshStreak(habit);
    await habit.save();
    res.status(201).json(habit);
  } catch (err) {
    next(err);
  }
};

const updateHabit = async (req, res, next) => {
  try {
    const habit = await Habit.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!habit) {
      res.status(404);
      throw new Error('Habit not found');
    }
    Object.assign(habit, req.body);
    // If dates were provided (e.g. restoring a habit) keep streak consistent.
    if (req.body.completedDates) refreshStreak(habit);
    const updated = await habit.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * Toggle endpoint — single source of truth for marking a habit done.
 * Marks/unmarks TODAY (WIB), then recomputes streak + bestStreak from history.
 */
const toggleHabit = async (req, res, next) => {
  try {
    const habit = await Habit.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!habit) {
      res.status(404);
      throw new Error('Habit not found');
    }

    const today = getTodayLocalDate();
    refreshStreak(habit);
    const completedToday = habit.completedDates.includes(today);

    if (completedToday) {
      habit.completedDates = habit.completedDates.filter((d) => d !== today);
    } else {
      habit.completedDates = [...habit.completedDates, today].sort();
    }

    refreshStreak(habit);
    const updated = await habit.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteHabit = async (req, res, next) => {
  try {
    const habit = await Habit.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!habit) {
      res.status(404);
      throw new Error('Habit not found');
    }
    res.json({ message: 'Habit removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getHabits, createHabit, updateHabit, toggleHabit, deleteHabit };
