const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Budget amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    month: {
      type: String,
      required: [true, 'Month is required (YYYY-MM)'],
    },
    spent: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

budgetSchema.index({ user: 1, month: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
