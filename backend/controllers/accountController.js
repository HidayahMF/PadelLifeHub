const Account = require('../models/Account');

function invalidateCache(userId) {
  try {
    const { invalidateUserCache } = require('../services/aiContext')._cacheUtils;
    if (invalidateUserCache) invalidateUserCache(userId);
  } catch {
    // Non-fatal — cache module may not be loaded yet in test stubs.
  }
}

const getAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ user: req.user._id }).sort({
      createdAt: 1,
    });
    res.json(accounts);
  } catch (err) {
    next(err);
  }
};

const createAccount = async (req, res, next) => {
  try {
    const account = await Account.create({
      user: req.user._id,
      ...req.body,
    });
    invalidateCache(req.user._id);
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }

    Object.assign(account, req.body);
    const updated = await account.save();
    invalidateCache(req.user._id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }

    invalidateCache(req.user._id);
    res.json({ message: 'Account removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAccounts, createAccount, updateAccount, deleteAccount };
