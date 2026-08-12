const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    theme: {
      type: String,
      default: 'default',
    },
    darkMode: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      default: 'en',
    },
    notifications: {
      taskReminders: { type: Boolean, default: true },
      billReminders: { type: Boolean, default: true },
      habitReminders: { type: Boolean, default: true },
      emailUpdates: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
