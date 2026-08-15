// Focused unit test for the Google login flow (authController.googleLogin).
//
// A real Google ID token cannot be minted locally, so `verifyIdToken` is
// mocked to return deterministic payloads. This exercises every code path:
// new user, email account linking, existing Google user, password guards.
//
// Run: node scripts/test-google-login.js
// Requires MONGODB_URI in backend/.env.

process.env.TZ = process.env.TZ || 'Asia/Jakarta';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const dns = require('dns');
// Some local resolvers refuse SRV lookups; route c-ares to public DNS.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const connectDB = require('../config/db');
const User = require('../models/User');
const Setting = require('../models/Setting');
const Category = require('../models/Category');
const { googleLogin } = require('../controllers/authController');

// Keep the controller deterministic regardless of .env.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// Deterministic fake token verification.
let fakePayload = {};
OAuth2Client.prototype.verifyIdToken = async function () {
  return { getPayload: () => ({ ...fakePayload }) };
};

function callGoogleLogin(idToken) {
  const req = { body: { idToken } };
  let status = 0;
  let body = null;
  let error = null;
  const res = {
    status(code) {
      status = code;
      return res;
    },
    json(payload) {
      // Express defaults res.json() to 200 when res.status() was never called.
      if (!status) status = 200;
      body = payload;
      return res;
    },
  };
  const next = (err) => {
    error = err;
  };
  return googleLogin(req, res, next).then(() => ({ status, body, error }));
}

function profileLike(body) {
  return body ? `${body.email} provider=${body.provider} hasPassword=${body.hasPassword}` : 'no body';
}

async function main() {
  await connectDB();
  const stamp = Date.now();
  const emails = {
    fresh: `gl-fresh-${stamp}@lifehub.local`,
    linked: `gl-linked-${stamp}@lifehub.local`,
    existingGoogle: `gl-existing-${stamp}@lifehub.local`,
  };
  const users = [];

  console.log('== Google login unit test ==\n');

  // ---------- CASE A: brand new Google user ----------
  console.log('[new Google user]');
  fakePayload = {
    sub: `sub-fresh-${stamp}`,
    email: emails.fresh,
    email_verified: true,
    name: 'Fresh Google',
    picture: 'https://lh3.googleusercontent.com/pic-fresh',
  };
  const fresh = await callGoogleLogin('fake-id-token-fresh');
  const freshUser = await User.findById(fresh.body?._id);
  users.push(freshUser);
  check('token verification accepted → login response', fresh.status === 201 && !!fresh.body?.token, profileLike(fresh.body));
  check('provider=google + googleId saved', freshUser?.provider === 'google' && freshUser?.googleId === fakePayload.sub);
  check('name + email + avatar from token', freshUser?.name === 'Fresh Google' && freshUser?.email === emails.fresh && freshUser?.avatar === fakePayload.picture);
  const freshSettings = await Setting.findOne({ user: freshUser._id });
  check('settings created', !!freshSettings);
  check('onboarding status not_started (tour will show)', freshSettings?.onboarding?.status === 'not_started');
  const freshCategories = await Category.countDocuments({ user: freshUser._id });
  check('default categories seeded', freshCategories >= 3, `${freshCategories} categories`);
  check('hasPassword=false for Google-only', fresh.body?.hasPassword === false);

  // ---------- CASE B: existing email/password account gets linked ----------
  console.log('\n[existing email account link]');
  const existing = await User.create({
    name: 'Old User',
    email: emails.linked,
    password: 'oldpassword123',
  });
  users.push(existing);
  fakePayload = {
    sub: `sub-linked-${stamp}`,
    email: emails.linked,
    email_verified: true,
    name: 'Old User Google',
    picture: 'https://lh3.googleusercontent.com/pic-linked',
  };
  const linked = await callGoogleLogin('fake-id-token-linked');
  const linkedCount = await User.countDocuments({ email: emails.linked });
  const linkedUser = await User.findById(linked.body?._id).select('+password');
  check('linked login returns token', linked.status === 200 && !!linked.body?.token, profileLike(linked.body));
  check('no duplicate account created', linkedCount === 1, `${linkedCount} accounts`);
  check('googleId linked to existing account', linkedUser?.googleId === fakePayload.sub);
  check('provider upgraded to google', linkedUser?.provider === 'google');
  check('existing password preserved (bcrypt hashed)', !!linkedUser?.password?.startsWith('$2'));
  check('hasPassword=true for linked account', linked.body?.hasPassword === true);

  // Regression: password login still matches after linking.
  check('password still matches after linking', (await linkedUser.matchPassword('oldpassword123')) === true);

  // ---------- CASE C: existing Google account logs in ----------
  console.log('\n[existing Google account]');
  fakePayload = {
    sub: `sub-fresh-${stamp}`,
    email: emails.fresh,
    email_verified: true,
    name: 'Fresh Google Renamed',
    picture: 'https://lh3.googleusercontent.com/pic-new',
  };
  const again = await callGoogleLogin('fake-id-token-again');
  const countAgain = await User.countDocuments({ email: emails.fresh });
  check('existing Google user logs in (no new account)', again.status === 200 && countAgain === 1, profileLike(again.body));

  // ---------- Error handling ----------
  console.log('\n[error handling]');
  const missing = await callGoogleLogin(undefined);
  check('missing idToken → 400', missing.status === 400 && !!missing.error);

  fakePayload = { sub: 'x', email: '', email_verified: true, name: 'No Email' };
  const noEmail = await callGoogleLogin('fake-token-no-email');
  check('no verified email → 400', noEmail.status === 400 && !!noEmail.error);

  fakePayload = { sub: 'x', email: 'unverified@lifehub.local', email_verified: false, name: 'Not Verified' };
  const unverified = await callGoogleLogin('fake-token-unverified');
  check('unverified email → 400', unverified.status === 400 && !!unverified.error);

  // ---------- Password guards ----------
  console.log('\n[password guards]');
  const googleOnly = await User.findById(fresh.body._id).select('+password');
  check('google-only user has no password', googleOnly?.password === undefined);
  const changePassword = require('../controllers/authController').changePassword;
  const req2 = { user: { _id: fresh.body._id }, body: { currentPassword: 'x', newPassword: 'abcdef' } };
  const res2 = { status(c) { res2.statusCode = c; return res2; }, json() { return res2; } };
  const next2 = (err) => { res2.nextErr = err; };
  await changePassword(req2, res2, next2);
  check('change password rejected for google-only', res2.statusCode === 400 && !!res2.nextErr);

  const forgotCtl = require('../controllers/authController').forgotPassword;
  const req3 = { body: { email: emails.fresh } };
  const res3 = { status(c) { res3.statusCode = c; return res3; }, json(p) { res3.payload = p; return res3; } };
  const next3 = (err) => { res3.nextErr = err; };
  await forgotCtl(req3, res3, next3);
  check('forgot-password informs google account', !!res3.payload && res3.payload.message.includes('Google'));

  // ---------- CLEANUP ----------
  console.log('\n[cleanup]');
  for (const u of users) {
    if (!u) continue;
    await User.deleteOne({ _id: u._id });
    await Setting.deleteOne({ user: u._id });
    await Category.deleteMany({ user: u._id });
  }
  await mongoose.disconnect();
  check('test users cleaned up', true);

  // ---------- SUMMARY ----------
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== ${results.length - failed.length}/${results.length} checks passed ==`);
  if (failed.length > 0) {
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Google login test crashed:', err);
  process.exit(1);
});
