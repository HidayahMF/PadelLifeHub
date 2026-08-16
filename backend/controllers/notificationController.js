const Notification = require('../models/Notification');
const Task = require('../models/Task');

const getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit);

    // Prune stale task notifications in-place: a notification whose linked task
    // was deleted, completed, archived or trashed must never be shown — nor
    // re-surfaced as a browser popup on every page refresh. This also heals
    // rows created before cleanup-on-delete existed.
    const taskNotifs = notifications.filter((n) => n.type === 'task' && n.relatedId);
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
      const stale = taskNotifs.filter((n) => !valid.has(String(n.relatedId)));
      if (stale.length) {
        await Notification.deleteMany({
          _id: { $in: stale.map((n) => n._id) },
          user: req.user._id,
        });
        return res.json(notifications.filter((n) => !stale.includes(n)));
      }
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
