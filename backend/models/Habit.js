const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Habit name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily',
    },
    // Calendar dates as "YYYY-MM-DD" strings (Asia/Jakarta). Storing strings
    // keeps day-level comparisons exact and free from UTC drift.
    completedDates: {
      type: [String],
      default: [],
    },
    streak: {
      type: Number,
      default: 0,
    },
    bestStreak: {
      type: Number,
      default: 0,
    },
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Habit', habitSchema);
