const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['income', 'expense', 'transfer'],
      required: [true, 'Transaction type is required'],
    },
    financeScope: {
      type: String,
      enum: ['personal', 'business'],
      default: 'personal',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    businessProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessProject',
      default: null,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    // Transfers move money between two accounts and never count as
    // income/expense in any statistic.
    fromAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    toAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    recurring: {
      isRecurring: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        default: 'monthly',
      },
    },
    nextRunAt: {
      type: Date,
      default: null,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    parentRecurringId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    // Legacy investment migration traceability. When a legacy expense that was
    // really investment capital is migrated into the dedicated investment
    // system, the ORIGINAL transaction is NOT deleted — it is flagged here so
    // every expense aggregation excludes it (no double counting) while the
    // record stays recoverable and links to the new InvestmentTransaction.
    migratedToInvestment: {
      type: Boolean,
      default: false,
    },
    investmentTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InvestmentTransaction',
      default: null,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ user: 1, financeScope: 1, date: -1 });
transactionSchema.index({ user: 1, businessProject: 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
