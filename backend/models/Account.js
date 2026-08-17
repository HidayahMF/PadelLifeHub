const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['cash', 'bank', 'ewallet', 'investment'],
      default: 'cash',
    },
    balance: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'IDR',
    },
  },
  { timestamps: true }
);

accountSchema.index({ user: 1, name: 1 });

module.exports = mongoose.model('Account', accountSchema);
