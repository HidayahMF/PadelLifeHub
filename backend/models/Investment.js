const mongoose = require('mongoose');

// An investment portfolio owned by a single user. No stored balance fields —
// the current value, capital and profit/loss are all DERIVED from the linked
// InvestmentTransaction documents at read time. This keeps edit/delete of
// individual records consistent without ever drifting from a cached total.
const investmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Portfolio name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // Short-lived lease used to serialize value-sync calculations per portfolio.
    syncLockUntil: { type: Date, default: null },
    lastSyncRequestId: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

investmentSchema.index({ user: 1, name: 1 });

module.exports = mongoose.model('Investment', investmentSchema);
