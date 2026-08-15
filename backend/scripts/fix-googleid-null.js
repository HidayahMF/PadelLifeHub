// One-time data repair: remove the explicit `googleId: null` that the previous
// schema default used to write. Sparse unique indexes still index `null`, so
// those docs would block all future registrations.
//
// Run: node scripts/fix-googleid-null.js
// Requires MONGODB_URI in backend/.env (or overridden via env).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const dns = require('dns');
// Some local resolvers refuse SRV lookups; route c-ares to public DNS.
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  const col = mongoose.connection.collection('users');

  const affected = await col.countDocuments({ googleId: null });
  const res = await col.updateMany({ googleId: null }, { $unset: { googleId: 1 } });
  console.log(`unset googleId:null on ${res.modifiedCount} of ${affected} docs`);

  const left = await col.countDocuments({ googleId: null });
  console.log('remaining googleId:null docs:', left);

  const idx = await col.indexes();
  console.log('indexes:', idx.map((i) => `${i.name} keys=${JSON.stringify(i.key)} unique=${!!i.unique} sparse=${!!i.sparse}`).join(' | '));

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
