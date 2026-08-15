const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      // Optional on purpose: Google-created accounts have no local password.
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    provider: {
      type: String,
      enum: ['email', 'google'],
      default: 'email',
    },
    googleId: {
      type: String,
      // NOTE: no `default: null` on purpose. A MongoDB sparse index indexes
      // documents that explicitly contain `null` but skips documents where the
      // field is absent, so email-only users must not carry a googleId field at
      // all, otherwise the second null violates the unique index.
      unique: true,
      sparse: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  // Hash only when the password changed AND it is not already a bcrypt hash
  // (prevents double-hashing during the legacy plaintext migration).
  if (this.isModified('password') && this.password && !this.password.startsWith('$2')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  // Accounts without a local password (Google-only) can never match.
  if (!this.password) return false;

  // bcrypt hash → normal compare.
  if (this.password.startsWith('$2')) {
    return bcrypt.compare(enteredPassword, this.password);
  }

  // Legacy plaintext password: migrate to a hash on first successful login.
  const matches = enteredPassword === this.password;
  if (matches) {
    this.password = await bcrypt.hash(enteredPassword, 10);
    await this.save();
  }
  return matches;
};

module.exports = mongoose.model('User', userSchema);
