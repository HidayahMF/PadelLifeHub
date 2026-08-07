const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    savingProgress: {
      type: Number,
      default: 0,
      min: [0, 'Cannot be negative'],
    },
    targetDate: {
      type: Date,
      default: null,
    },
    link: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['saved', 'in-progress', 'purchased'],
      default: 'saved',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wishlist', wishlistSchema);
