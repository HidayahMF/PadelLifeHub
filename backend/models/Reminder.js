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
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        default: 'monthly',
      },
    },
    sent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ user: 1, datetime: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
