const mongoose = require('mongoose');

const businessProjectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: [true, 'Project name is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    status: { type: String, enum: ['planned', 'active', 'completed', 'cancelled'], default: 'active' },
  },
  { timestamps: true }
);

businessProjectSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('BusinessProject', businessProjectSchema);
