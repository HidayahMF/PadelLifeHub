const Task = require('../models/Task');
const Category = require('../models/Category');
const Notification = require('../models/Notification');
const { nextOccurrence } = require('../services/taskScheduler');
const { cleanupTaskReminders } = require('../services/reminderScheduler');

/** Recompute nextOccurrence from a task's due date + recurring config. */
function computeNextOccurrence(dueDate, recurring) {
  if (!recurring || !recurring.isRecurring) return null;
  const base = dueDate ? new Date(dueDate) : new Date();
  return nextOccurrence(base, recurring.frequency || 'monthly', recurring.daysOfWeek);
}

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
    const { status, category, search, archived, trashed, tag, sort } = req.query;
    const filter = { user: req.user._id };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (trashed !== undefined) filter.trashed = trashed === 'true';
    else filter.trashed = { $ne: true };
    // Archived items stay out of the default (active) list.
    if (archived !== undefined) filter.archived = archived === 'true';
    else filter.archived = { $ne: true };
    if (tag) filter.tags = tag;

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
    const body = { ...req.body };
    if (body.recurring !== undefined) {
      body.recurring = { isRecurring: false, frequency: 'monthly', daysOfWeek: [], ...body.recurring };
      body.nextOccurrence = computeNextOccurrence(body.dueDate, body.recurring);
    }
    const task = await Task.create({
      user: req.user._id,
      ...body,
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

    // Keep the recurrence schedule in sync with due date / recurrence edits.
    if (body.recurring !== undefined) {
      body.recurring = { ...task.recurring?.toObject?.() ?? {}, ...body.recurring };
      body.nextOccurrence = computeNextOccurrence(
        body.dueDate !== undefined ? body.dueDate : task.dueDate,
        body.recurring
      );
    } else if (body.dueDate !== undefined && task.recurring?.isRecurring) {
      body.nextOccurrence = computeNextOccurrence(body.dueDate, task.recurring);
    }
    if (body.recurring && body.recurring.isRecurring === false) {
      body.nextOccurrence = null;
    }

    Object.assign(task, body);
    const updated = await task.save();

    // A completed, archived or trashed task must never fire a reminder again:
    // deactivate every Reminder doc linked to it (visible in the calendar but
    // inert) and drop its notifications so stale "Task due reminder" items
    // don't linger. The scheduler also validates this at runtime as a backstop.
    if (updated.status === 'completed' || updated.archived || updated.trashed) {
      await cleanupTaskReminders({
        user: req.user._id,
        taskId: updated._id,
        remove: false,
      });
      await Notification.deleteMany({
        user: req.user._id,
        type: 'task',
        relatedId: updated._id,
      });
    }

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

    // Remove linked reminders + notifications so a deleted task can never fire
    // again nor leave stale "Task due reminder" items behind.
    await cleanupTaskReminders({
      user: req.user._id,
      taskId: task._id,
      remove: true,
    });
    await Notification.deleteMany({
      user: req.user._id,
      type: 'task',
      relatedId: task._id,
    });

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
