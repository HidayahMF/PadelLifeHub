const mongoose = require('mongoose');

// Persistent Pomodoro focus sessions.
//
// The client-side timer sends one document per focus run (completed when the
// timer finishes naturally, interrupted when the user stops/resets early).
// `clientId` is a client-generated UUID that makes writes idempotent: a
// retried or double-sent request can never create a second session.
const focusSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Client-generated idempotency key for this focus run.
    clientId: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      default: null,
    },
    // Duration in seconds actually focused.
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['completed', 'interrupted'],
      default: 'completed',
    },
    // Optional link to the task being worked on (not wired in the UI yet).
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
  },
  { timestamps: true }
);

// One session per user per focus run — the duplicate-prevention guarantee.
focusSessionSchema.index({ user: 1, clientId: 1 }, { unique: true });
// Stats queries always filter by user + time range.
focusSessionSchema.index({ user: 1, startTime: -1 });

module.exports = mongoose.model('FocusSession', focusSessionSchema);
