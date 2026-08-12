const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Goal title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    // 'savings' goals are financial targets (target = amount of money) and get
    // extra money-aware UI (remaining amount, required monthly saving).
    kind: {
      type: String,
      enum: ['general', 'savings'],
      default: 'general',
    },
    target: {
      type: Number,
      default: null,
    },
    unit: {
      type: String,
      default: '',
    },
    progress: {
      type: Number,
      default: 0,
      min: [0, 'Cannot be negative'],
    },
    deadline: {
      type: Date,
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
    archived: {
      type: Boolean,
      default: false,
    },
    trashed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Goal', goalSchema);
