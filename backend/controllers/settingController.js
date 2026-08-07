const Setting = require('../models/Setting');

const getSettings = async (req, res, next) => {
  try {
    let settings = await Setting.findOne({ user: req.user._id });
    if (!settings) {
      settings = await Setting.create({ user: req.user._id });
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    let settings = await Setting.findOne({ user: req.user._id });
    if (!settings) {
      settings = await Setting.create({ user: req.user._id });
    }

    Object.assign(settings, req.body);
    const updated = await settings.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

module.exports = { getSettings, updateSettings };
