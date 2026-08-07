const Habit = require('../models/Habit');

const getHabits = async (req, res, next) => {
  try {
    const habits = await Habit.find({ user: req.user._id }).sort({
      createdAt: 1,
    });
    res.json(habits);
  } catch (err) {
    next(err);
  }
};

const createHabit = async (req, res, next) => {
  try {
    const habit = await Habit.create({
      user: req.user._id,
      ...req.body,
    });
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
    const updated = await habit.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completedToday = habit.completedDates.some((d) => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === today.getTime();
    });

    if (completedToday) {
      habit.completedDates = habit.completedDates.filter((d) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date.getTime() !== today.getTime();
      });
      habit.streak = Math.max(0, habit.streak - 1);
    } else {
      habit.completedDates.push(today);
      habit.streak += 1;
      habit.bestStreak = Math.max(habit.bestStreak, habit.streak);
    }

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
