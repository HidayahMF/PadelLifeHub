// One-off migration: replace the old sparse unique index on tasks
// (user + recurrenceId + dueDate) with a partial unique index that only
// applies to scheduler-generated children.
//
// The old sparse index counted `recurrenceId: null` as an indexed value, so
// every ordinary task without a due date collided on {user, null, null} and
// only ONE such task could ever be created per user.
//
// Usage: node scripts/fix-task-index.js

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const OLD_INDEX = 'user_1_recurrenceId_1_dueDate_1';
const NEW_INDEX = {
  user: 1,
  recurrenceId: 1,
  dueDate: 1,
};

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  await connectDB(); // handles the DNS fallback like the main server
  const col = mongoose.connection.collection('tasks');

  const indexes = await col.indexes();
  const oldExists = indexes.some((i) => i.name === OLD_INDEX);

  if (oldExists) {
    await col.dropIndex(OLD_INDEX);
    console.log(`dropped old index ${OLD_INDEX}`);
  } else {
    console.log(`old index ${OLD_INDEX} not found (already migrated?)`);
  }

  // Create the partial unique index (recreate if needed).
  await col.createIndex(NEW_INDEX, {
    unique: true,
    name: OLD_INDEX,
    partialFilterExpression: { recurrenceId: { $type: 'objectId' } },
  });
  console.log('created partial unique index (children only)');

  await mongoose.disconnect();
  console.log('done');
}

run().catch((err) => {
  console.error('migration failed:', err.message);
  process.exit(1);
});
