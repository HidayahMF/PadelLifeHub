const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const User = require('../models/User');
const Setting = require('../models/Setting');
const Category = require('../models/Category');
const generateToken = require('../utils/generateToken');

/**
 * Default categories every new account starts with. The UI has no category
 * management screen, so without these a fresh user cannot save an expense
 * (which requires a category) or categorize tasks.
 */
const DEFAULT_CATEGORIES = [
  // transaction
  { name: 'Salary', color: '#00C2A8', icon: 'wallet', type: 'transaction' },
  { name: 'Food', color: '#FF9F1C', icon: 'utensils', type: 'transaction' },
  { name: 'Transport', color: '#FF5DA2', icon: 'car', type: 'transaction' },
  { name: 'Shopping', color: '#FFD600', icon: 'shopping-bag', type: 'transaction' },
  { name: 'Bills', color: '#FF4D4D', icon: 'receipt', type: 'transaction' },
  { name: 'Entertainment', color: '#6366f1', icon: 'clapperboard', type: 'transaction' },
  { name: 'Health', color: '#00C2A8', icon: 'heart-pulse', type: 'transaction' },
  // task
  { name: 'Personal', color: '#FF5DA2', icon: 'user', type: 'task' },
  { name: 'Work', color: '#6366f1', icon: 'briefcase', type: 'task' },
  { name: 'Urgent', color: '#FF4D4D', icon: 'alert-triangle', type: 'task' },
];

/** Create the default categories for a brand new user (best-effort). */
async function seedDefaultCategories(userId) {
  try {
    const existing = await Category.countDocuments({ user: userId });
    if (existing > 0) return;
    await Category.insertMany(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, user: userId }))
    );
  } catch (err) {
    // A failed seed must never block registration.
    console.error(`[categories] seed failed for ${userId}: ${err.message}`);
  }
}

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const AVATAR_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, `${crypto.randomBytes(16).toString('hex')}${AVATAR_EXT[file.mimetype]}`),
});

/** Multer middleware: accepts a single 'avatar' image field. */
const avatarUpload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!AVATAR_EXT[file.mimetype]) {
      const err = new Error('Only JPG, PNG, WebP or GIF images are allowed');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
}).single('avatar');

/** Delete an uploaded file from disk (ignores missing files). */
function removeUploadedFile(url) {
  if (!url || typeof url !== 'string') return;
  const match = url.match(/\/uploads\/([^/?]+)/);
  if (!match) return;
  fs.unlink(path.join(UPLOAD_DIR, match[1]), () => {});
}

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No image uploaded');
    }
    const user = await User.findById(req.user._id);
    removeUploadedFile(user.avatar);

    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    user.avatar = url;
    await user.save();

    res.json({ _id: user._id, name: user.name, email: user.email, avatar: user.avatar });
  } catch (err) {
    if (req.file) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    next(err);
  }
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Please provide name, email and password');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    const user = await User.create({ name, email, password });
    await Setting.create({ user: user._id });
    await seedDefaultCategories(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please provide email and password');
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    user.name = req.body.name || user.name;
    user.avatar = req.body.avatar !== undefined ? req.body.avatar : user.avatar;

    const updated = await user.save();
    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      avatar: updated.avatar,
    });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400);
      throw new Error('Please provide your email');
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      // Do not reveal whether an account exists for this email.
      return res.json({
        message: 'If that email is registered, a password reset is now available.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const payload = {
      message:
        'Password reset started. A reset email will be sent once the email service is configured.',
    };
    // No email transport is configured yet. In non-production the reset token
    // is returned so the flow can be completed and tested end-to-end locally.
    if (process.env.NODE_ENV !== 'production') {
      payload.resetToken = token;
      payload.resetExpires = user.resetPasswordExpires;
    }
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400);
      throw new Error('Token and new password are required');
    }
    if (newPassword.length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters');
    }

    const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      res.status(400);
      throw new Error('Reset token is invalid or has expired');
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400);
      throw new Error('Please provide current and new password');
    }

    if (newPassword.length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters');
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      res.status(401);
      throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  uploadAvatar,
  avatarUpload,
};
