require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Setting = require('../models/Setting');
const Task = require('../models/Task');
const generateToken = require('../utils/generateToken');

(async () => {
  await connectDB();

  const user = await User.create({
    name: 'Test User',
    email: 'test@lifehub.dev',
    password: 'secret123',
  });
  console.log('User created:', user._id.toString());
  console.log('Token OK:', generateToken(user._id).length > 20);

  await Setting.create({ user: user._id });

  const task = await Task.create({
    user: user._id,
    title: 'Setup backend',
  });
  console.log('Task created:', task.title);

  const fetched = await User.findOne({ email: 'test@lifehub.dev' }).select('+password');
  console.log('Password match:', await fetched.matchPassword('secret123'));

  await Task.deleteOne({ _id: task._id });
  await Setting.deleteOne({ user: user._id });
  await User.deleteOne({ _id: user._id });
  console.log('Cleanup done. ALL CHECKS PASSED');
  process.exit(0);
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
