const mongoose = require('mongoose');

// A single value change on an investment portfolio.
//   deposit    — money moved INTO the investment (cash decreases, asset increases)
//   withdrawal — money moved OUT of the investment (asset decreases, cash increases)
//   gain       — unrealized/realized increase in investment value (no cash change)
//   loss       — decrease in investment value (no cash change)
//
// Gains/losses are value movements ONLY — they never create a normal expense
// or income transaction. Deposits/withdrawals are capital movements.
const investmentTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    investment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investment',
      required: [true, 'Investment portfolio is required'],
    },
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'gain', 'loss'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    transaction_date: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    // Present only on transactions created by the Update Value endpoint.
    syncRequestId: { type: String, trim: true },
  },
  { timestamps: true }
);

investmentTransactionSchema.index({ user: 1, investment: 1, transaction_date: 1 });
investmentTransactionSchema.index(
  { user: 1, investment: 1, syncRequestId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('InvestmentTransaction', investmentTransactionSchema);
