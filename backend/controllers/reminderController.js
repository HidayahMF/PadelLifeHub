const Reminder = require('../models/Reminder');

const getReminders = async (req, res, next) => {
  try {
    const { type, upcoming, sent } = req.query;
    const filter = { user: req.user._id };

    if (type) filter.type = type;
    if (upcoming === 'true') {
      filter.datetime = { $gte: new Date() };
      filter.sent = false;
    }
    if (sent === 'true') filter.sent = true;
    if (sent === 'false') filter.sent = false;

    const reminders = await Reminder.find(filter).sort({ datetime: 1 });
    res.json(reminders);
  } catch (err) {
    next(err);
  }
};

const createReminder = async (req, res, next) => {
  try {
    const reminder = await Reminder.create({
      user: req.user._id,
      ...req.body,
    });
    res.status(201).json(reminder);
  } catch (err) {
    next(err);
  }
};

const updateReminder = async (req, res, next) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!reminder) {
      res.status(404);
      throw new Error('Reminder not found');
    }
    Object.assign(reminder, req.body);
    // A changed datetime means the reminder should fire again.
    if (req.body.datetime !== undefined) {
      reminder.sent = false;
    }
    const updated = await reminder.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteReminder = async (req, res, next) => {
  try {
    const reminder = await Reminder.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!reminder) {
      res.status(404);
      throw new Error('Reminder not found');
    }
    res.json({ message: 'Reminder removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getReminders, createReminder, updateReminder, deleteReminder };
