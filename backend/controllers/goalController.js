const Goal = require('../models/Goal');

const getGoals = async (req, res, next) => {
  try {
    const { completed } = req.query;
    const filter = { user: req.user._id };
    if (completed !== undefined) filter.completed = completed === 'true';

    const goals = await Goal.find(filter).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    next(err);
  }
};

const createGoal = async (req, res, next) => {
  try {
    const goal = await Goal.create({
      user: req.user._id,
      ...req.body,
    });
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
};

const updateGoal = async (req, res, next) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
    if (!goal) {
      res.status(404);
      throw new Error('Goal not found');
    }

    const body = { ...req.body };
    if (goal.target && body.progress !== undefined && body.progress >= goal.target) {
      body.completed = true;
    }
    if (body.completed === false) body.completed = false;

    Object.assign(goal, body);
    const updated = await goal.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteGoal = async (req, res, next) => {
  try {
    const goal = await Goal.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!goal) {
      res.status(404);
      throw new Error('Goal not found');
    }
    res.json({ message: 'Goal removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getGoals, createGoal, updateGoal, deleteGoal };
