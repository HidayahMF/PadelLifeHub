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
    // Ordered list of visible dashboard widget keys — per user, not global.
    // Hides currency amounts on the dashboard (privacy toggle).
    hideBalance: {
      type: Boolean,
      default: false,
    },
    // First-run onboarding / interactive tour state.
    onboarding: {
      status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'skipped'],
        default: 'not_started',
      },
      completedAt: {
        type: Date,
        default: null,
      },
    },
    dashboardWidgets: {
      type: [String],
      default: [
        'stats',
        'finance',
        'today',
        'upcoming',
        'habits',
        'chart',
        'budget',
        'goals',
        'wishlist',
        'recent',
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
