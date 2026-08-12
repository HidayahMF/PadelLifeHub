const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Task title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    tags: {
      type: [String],
      default: [],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'completed'],
      default: 'todo',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    reminder: {
      type: Date,
      default: null,
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
    archived: {
      type: Boolean,
      default: false,
    },
    trashed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Recurring task series — the parent task stays active while the scheduler
    // generates a fresh child task for each occurrence.
    recurring: {
      isRecurring: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
        default: 'monthly',
      },
      // For custom weekly schedules: 0=Sunday .. 6=Saturday. Empty = every week.
      daysOfWeek: { type: [Number], default: [] },
    },
    // Parent id set on scheduler-generated child tasks (idempotency key).
    recurrenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    nextOccurrence: {
      type: Date,
      default: null,
    },
    lastGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

taskSchema.index({ user: 1, status: 1 });
taskSchema.index({ user: 1, dueDate: 1 });
// Unique partial index: guarantees a recurring series can never generate the
// same occurrence twice, even across scheduler restarts. It only applies to
// scheduler-generated children (recurrenceId is a real ObjectId there), so
// ordinary tasks without due dates never collide on {user, null, null}.
taskSchema.index(
  { user: 1, recurrenceId: 1, dueDate: 1 },
  { unique: true, partialFilterExpression: { recurrenceId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Task', taskSchema);
