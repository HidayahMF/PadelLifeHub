const Notification = require('../models/Notification');
const Task = require('../models/Task');
const Reminder = require('../models/Reminder');

/** Which of the given notifications reference an entity that no longer exists. */
async function orphanedBy(notifications, model) {
  const linked = notifications.filter((n) => n.relatedId);
  if (!linked.length) return [];
  const ids = [...new Set(linked.map((n) => String(n.relatedId)))];
  const docs = await model.find({ _id: { $in: ids } }).select('_id').lean();
  const valid = new Set(docs.map((d) => String(d._id)));
  return linked.filter((n) => !valid.has(String(n.relatedId)));
}

const getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit);

    // Prune stale notifications in-place: a notification whose linked entity
    // was deleted must never be shown — nor re-surfaced as a browser popup on
    // every page refresh. This also heals rows created before cleanup existed.
    // Task notifications are additionally pruned when the task is completed,
    // archived or trashed (not only when it is gone).
    const taskNotifs = notifications.filter((n) => n.type === 'task' && n.relatedId);
    const prunedTasks = [];
    if (taskNotifs.length) {
      const taskIds = [...new Set(taskNotifs.map((n) => String(n.relatedId)))];
      const tasks = await Task.find({ _id: { $in: taskIds } })
        .select('status archived trashed')
        .lean();
      const valid = new Set(
        tasks
          .filter((t) => t.status !== 'completed' && !t.archived && !t.trashed)
          .map((t) => String(t._id))
      );
      prunedTasks.push(
        ...taskNotifs.filter((n) => !valid.has(String(n.relatedId)))
      );
    }

    // Reminder notifications: pruned only when the reminder itself no longer
    // exists (a live, already-fired reminder keeps its notification).
    const reminderNotifs = notifications.filter(
      (n) => n.type === 'reminder' && n.relatedId
    );

    const stale = [
      ...prunedTasks,
      ...(await orphanedBy(reminderNotifs, Reminder)),
    ];
    if (stale.length) {
      await Notification.deleteMany({
        _id: { $in: stale.map((n) => n._id) },
        user: req.user._id,
      });
      return res.json(notifications.filter((n) => !stale.includes(n)));
    }

    res.json(notifications);
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });
    res.json({ unread: count });
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { read: true } },
      { new: true }
    );
    if (!notification) {
      res.status(404);
      throw new Error('Notification not found');
    }
    res.json(notification);
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!notification) {
      res.status(404);
      throw new Error('Notification not found');
    }
    res.json({ message: 'Notification removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
};
