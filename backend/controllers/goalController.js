const Goal = require('../models/Goal');

/** Validate a goal's numeric fields before persisting. */
function validateGoalBody(body) {
  if (body.target !== undefined && body.target !== null) {
    const t = Number(body.target);
    if (!Number.isFinite(t) || t <= 0) {
      const err = new Error('Target must be greater than zero');
      err.statusCode = 400;
      throw err;
    }
    body.target = t;
  }
  if (body.progress !== undefined) {
    const p = Number(body.progress);
    if (!Number.isFinite(p) || p < 0) {
      const err = new Error('Progress cannot be negative');
      err.statusCode = 400;
      throw err;
    }
    body.progress = p;
  }
  if (body.deadline && Number.isNaN(new Date(body.deadline).getTime())) {
    const err = new Error('Deadline must be a valid date');
    err.statusCode = 400;
    throw err;
  }
}

const getGoals = async (req, res, next) => {
  try {
    const { completed, archived, trashed, tag } = req.query;
    const filter = { user: req.user._id };
    if (completed !== undefined) filter.completed = completed === 'true';
    if (trashed !== undefined) filter.trashed = trashed === 'true';
    else filter.trashed = { $ne: true };
    if (archived !== undefined) filter.archived = archived === 'true';
    if (tag) filter.tags = tag;

    const goals = await Goal.find(filter).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    next(err);
  }
};

const createGoal = async (req, res, next) => {
  try {
    const body = { ...req.body };
    validateGoalBody(body);
    const goal = await Goal.create({
      user: req.user._id,
      ...body,
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
    validateGoalBody(body);
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
