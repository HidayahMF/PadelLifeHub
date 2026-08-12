require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  await connectDB();

  const email = process.argv[2] || 'padel@email.com';
  const password = process.argv[3] || '123456';

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    console.error('FAILED: user not found:', email);
    process.exit(1);
  }

  user.password = password;
  await user.save();

  console.log('Password reset for:', email, '->', password);
  process.exit(0);
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
