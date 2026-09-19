const mongoose = require('mongoose');

/**
 * Append-only ledger of manual balance adjustments. Adjustments are NOT
 * income / expense / transfer transactions — they only correct the stored
 * account balance so it matches reality (bank, e-wallet, marketplace store).
 * They never appear in income/expense aggregations.
 *
 * History is never edited or deleted after the fact (no update/delete
 * controllers expose it). The balance write is guarded by a conditional
 * findOneAndUpdate on `previousBalance`, so a concurrent transaction can
 * never be silently overwritten.
 */
const accountBalanceAdjustmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    previousBalance: {
      type: Number,
      required: [true, 'Previous balance is required'],
    },
    newBalance: {
      type: Number,
      required: [true, 'New balance is required'],
      min: [0, 'Balance cannot be negative'],
    },
    difference: {
      type: Number,
      required: [true, 'Difference is required'],
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
    },
    currency: {
      type: String,
      default: 'IDR',
    },
    adjustmentDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

accountBalanceAdjustmentSchema.index({ user: 1, account: 1, adjustmentDate: -1 });
accountBalanceAdjustmentSchema.index({ user: 1, adjustmentDate: -1 });

module.exports = mongoose.model('AccountBalanceAdjustment', accountBalanceAdjustmentSchema);