const mongoose = require('mongoose');

const weeklyReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Local (WIB) Monday of the reviewed week — the unique key per user/week.
    weekStart: {
      type: Date,
      required: true,
    },
    wentWell: {
      type: String,
      default: '',
    },
    improve: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

weeklyReviewSchema.index({ user: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyReview', weeklyReviewSchema);
