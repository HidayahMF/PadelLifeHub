const mongoose = require('mongoose');

const needSchema = new mongoose.Schema(
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
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    unit: {
      type: String,
      default: 'item',
    },
    price: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      default: 'general',
    },
    onShoppingList: {
      type: Boolean,
      default: false,
    },
    purchased: {
      type: Boolean,
      default: false,
    },
    purchaseHistory: [
      {
        date: { type: Date, default: Date.now },
        quantity: { type: Number, default: 1 },
        price: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Need', needSchema);
