const Task = require('../models/Task');
const Category = require('../models/Category');

/** Reject category references that do not belong to the user. */
async function validateCategory(userId, category) {
  if (!category) return;
  const cat = await Category.findOne({ _id: category, user: userId });
  if (!cat) {
    const err = new Error('Category not found');
    err.statusCode = 400;
    throw err;
  }
}

const getTasks = async (req, res, next) => {
  try {
    const { status, category, search, archived, sort } = req.query;
    const filter = { user: req.user._id };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (archived !== undefined) filter.archived = archived === 'true';

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    let sortBy = { pinned: -1, dueDate: 1 };
    if (sort === 'created') sortBy = { pinned: -1, createdAt: -1 };
    if (sort === 'dueDate') sortBy = { pinned: -1, dueDate: 1 };

    const tasks = await Task.find(filter)
      .sort(sortBy)
      .populate('category', 'name color icon');

    res.json(tasks);
  } catch (err) {
    next(err);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate('category', 'name color icon');

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
};

const createTask = async (req, res, next) => {
  try {
    await validateCategory(req.user._id, req.body.category);
    const task = await Task.create({
      user: req.user._id,
      ...req.body,
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    const body = { ...req.body };
    await validateCategory(req.user._id, body.category);
    if (body.status === 'completed') {
      body.completedAt = body.completedAt || Date.now();
    } else if (body.status && body.status !== 'completed') {
      body.completedAt = null;
    }

    // A changed reminder time must be notified again (compare instants, not
    // string-vs-Date, so plain edits never re-trigger a sent reminder).
    if (body.reminder !== undefined) {
      const newTime = body.reminder ? new Date(body.reminder).getTime() : null;
      const oldTime = task.reminder ? new Date(task.reminder).getTime() : null;
      if (newTime !== oldTime) body.reminderSentAt = null;
    }

    Object.assign(task, body);
    const updated = await task.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    res.json({ message: 'Task removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};
