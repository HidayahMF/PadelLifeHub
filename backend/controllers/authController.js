const crypto = require('crypto');
const multer = require('multer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Setting = require('../models/Setting');
const Category = require('../models/Category');
const generateToken = require('../utils/generateToken');
const { isConfigured, sendPasswordReset } = require('../services/emailService');
const { saveUploadedFile, removeFile } = require('../services/uploadService');

/**
 * Default categories every new account starts with. The UI has no category
 * management screen, so without these a fresh user cannot save an expense
 * (which requires a category) or categorize tasks.
 */
const DEFAULT_CATEGORIES = [
  // transaction
  { name: 'Salary', color: '#00C2A8', icon: 'wallet', type: 'transaction' },
  { name: 'Food & Drinks', color: '#FF9F1C', icon: 'utensils', type: 'transaction' },
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

/**
 * Provision the per-user default data a brand new account needs:
 * a Setting document (with onboarding status 'not_started') plus the
 * default task/transaction categories. Shared by email register and
 * Google register so every new user behaves identically.
 */
async function provisionNewUser(userId) {
  await Setting.create({ user: userId });
  await seedDefaultCategories(userId);
}

/** Shape every auth response so the frontend stores the same session data. */
function authResponse(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    provider: user.provider || 'email',
    hasPassword: !!user.password,
    token: generateToken(user._id),
  };
}

const AVATAR_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// Buffered in memory, then persisted via uploadService (Cloudinary in
// production, local disk in development).
const storage = multer.memoryStorage();

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

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No image uploaded');
    }
    const user = await User.findById(req.user._id);
    removeFile(user.avatar);

    const saved = await saveUploadedFile(req.file.buffer, req.file.mimetype);
    const url = saved.remote ? saved.url : `${req.protocol}://${req.get('host')}${saved.url}`;
    user.avatar = url;
    await user.save();

    res.json({ _id: user._id, name: user.name, email: user.email, avatar: user.avatar });
  } catch (err) {
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
    await provisionNewUser(user._id);

    res.status(201).json(authResponse(user));
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

    res.json(authResponse(user));
  } catch (err) {
    next(err);
  }
};

/**
 * Sign in (or create) a user from a Google Identity Services ID token.
 *
 * Identity data (googleId, email, name, picture) is never trusted from the
 * client — everything is extracted from the verified token payload.
 */
const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400);
      throw new Error('Google idToken is required');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('[auth] GOOGLE_CLIENT_ID is not configured');
      res.status(500);
      throw new Error('Google sign-in is not configured. Please try again later.');
    }

    let payload;
    try {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch (err) {
      console.error(`[auth] Google token verification failed: ${err.message}`);
      res.status(401);
      throw new Error('Google sign-in failed. Please try again.');
    }

    const googleId = payload.sub;
    const email = payload.email ? String(payload.email).toLowerCase() : '';
    const name = payload.name || (email.split('@')[0] ?? '') || 'Google User';
    const avatar = payload.picture || '';

    if (!email || payload.email_verified !== true) {
      res.status(400);
      throw new Error(
        'Your Google account does not have a verified email. Please use another account.'
      );
    }

    // CASE C — the Google identity is already linked to a LifeHub account.
    let user = await User.findOne({ googleId }).select('+password');
    if (user) {
      // Refresh profile data from the (verified) token.
      if (user.email !== email) user.email = email;
      user.name = name;
      if (avatar && avatar !== user.avatar) user.avatar = avatar;
      if (user.provider !== 'google') user.provider = 'google';
      await user.save();
      return res.json(authResponse(user));
    }

    // CASE B — the email already has a password account: link the Google
    // identity to it WITHOUT removing the existing password, so the user can
    // keep signing in with either method. No duplicate account is created.
    user = await User.findOne({ email }).select('+password');
    if (user) {
      user.googleId = googleId;
      user.provider = 'google';
      user.name = name;
      if (avatar && avatar !== user.avatar) user.avatar = avatar;
      await user.save();
      return res.json(authResponse(user));
    }

    // CASE A — brand new user: create the account, provision default data
    // exactly like the normal register flow, and log them in.
    user = await User.create({ name, email, avatar, provider: 'google', googleId });
    await provisionNewUser(user._id);
    res.status(201).json(authResponse(user));
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
    if (req.body.avatar !== undefined && req.body.avatar !== user.avatar) {
      removeFile(user.avatar);
      user.avatar = req.body.avatar;
    }

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

    const user = await User.findOne({ email: String(email).toLowerCase() }).select(
      '+password'
    );
    if (!user) {
      // Do not reveal whether an account exists for this email.
      return res.json({
        message: 'If that email is registered, a password reset is now available.',
      });
    }

    // Google-only accounts have no local password to reset.
    if (!user.password) {
      return res.json({
        message:
          'This account uses Google sign-in and does not have a password. Sign in with Google instead.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const baseUrl = (process.env.CLIENT_URL || 'http://localhost:4200').replace(/\/$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const emailSent = await sendPasswordReset(user.email, resetUrl);

    const payload = {
      message: emailSent
        ? 'Password reset email sent. Check your inbox.'
        : 'Password reset started. A reset email will be sent once the email service is configured.',
    };
    // In non-production, when no email transport is configured, the reset
    // token is returned so the flow can be completed and tested locally.
    if (!emailSent && process.env.NODE_ENV !== 'production') {
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
    if (!user.password) {
      res.status(400);
      throw new Error(
        'This account uses Google sign-in and does not have a password.'
      );
    }
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
  googleLogin,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  uploadAvatar,
  avatarUpload,
};
