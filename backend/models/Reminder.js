const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Reminder title is required'],
      trim: true,
    },
    datetime: {
      type: Date,
      required: [true, 'Reminder datetime is required'],
    },
    type: {
      type: String,
      enum: ['task', 'bill', 'shopping', 'goal', 'wishlist', 'custom'],
      default: 'custom',
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    recurring: {
      isRecurring: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        default: 'monthly',
      },
    },
    sent: {
      type: Boolean,
      default: false,
    },
    // Lifecycle guard: the scheduler ONLY processes reminders with active=true.
    // Set to false when the linked entity is completed, archived, trashed or
    // deleted, so a cancelled reminder can never fire — even a recurring one.
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ user: 1, datetime: 1 });
reminderSchema.index({ user: 1, type: 1, relatedId: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
