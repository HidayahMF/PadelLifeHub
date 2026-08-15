// One-time cleanup: remove test accounts created by integration/smoke scripts
// and ad-hoc deploy checks, together with all of their data.
//
// Test emails all match /@lifehub\.(local|dev)$/, /@test\.dev$/ or
// /@test\.com$/ — real users (e.g. hidayahmfadillah@gmail.com) are never
// matched.
//
// Run: node scripts/cleanup-test-users.cjs   (prints what it deletes)

require('dotenv').config();
const mongoose = require('mongoose');

const TEST_EMAIL_RE = /@(lifehub\.(local|dev)|test\.dev|test\.com)$/i;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[cleanup] connected');

  const User = require('../models/User');
  const users = await User.find({ email: TEST_EMAIL_RE }).select('_id email name');

  if (!users.length) {
    console.log('[cleanup] no test users found — nothing to do');
    await mongoose.disconnect();
    return;
  }

  console.log(`[cleanup] found ${users.length} test account(s):`);
  for (const u of users) console.log(`  - ${u.email} (${u.name})`);

  const ids = users.map((u) => u._id);

  let removedDocs = 0;
  for (const model of Object.values(mongoose.models)) {
    const name = model.modelName;
    if (name === 'User') continue;
    const filter = { user: { $in: ids } };
    try {
      const res = await model.deleteMany(filter);
      if (res.deletedCount > 0) {
        removedDocs += res.deletedCount;
        console.log(`[cleanup]   ${name}: removed ${res.deletedCount}`);
      }
    } catch (err) {
      console.log(`[cleanup]   ${name}: skipped (${err.message})`);
    }
  }

  const res = await User.deleteMany({ _id: { $in: ids } });
  console.log(`[cleanup] removed ${res.deletedCount} user(s) and ${removedDocs} related doc(s)`);

  await mongoose.disconnect();
  console.log('[cleanup] done');
}

run().catch((err) => {
  console.error('[cleanup] failed:', err.message);
  process.exit(1);
});
