const Task = require('../models/Task');

const getTasks = async (req, res, next) => {
  try {
    const { status, priority, category, search, archived, sort } = req.query;
    const filter = { user: req.user._id };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (archived !== undefined) filter.archived = archived === 'true';

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    let sortBy = { dueDate: 1 };
    if (sort === 'created') sortBy = { createdAt: -1 };
    if (sort === 'priority') sortBy = { priority: 1 };
    if (sort === 'dueDate') sortBy = { dueDate: 1 };

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
    if (body.status === 'completed') {
      body.completedAt = body.completedAt || Date.now();
    } else if (body.status && body.status !== 'completed') {
      body.completedAt = null;
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
