const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

const getTransactions = async (req, res, next) => {
  try {
    const { type, account, category, startDate, endDate, search } = req.query;
    const filter = { user: req.user._id };

    if (type) filter.type = type;
    if (account) filter.account = account;
    if (category) filter.category = category;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }

    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .populate('category', 'name color icon')
      .populate('account', 'name type');

    res.json(transactions);
  } catch (err) {
    next(err);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate('category', 'name color icon')
      .populate('account', 'name type');

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    res.json(transaction);
  } catch (err) {
    next(err);
  }
};

const adjustAccountBalance = async (transaction, delta = 1) => {
  if (transaction.account) {
    const account = await Account.findById(transaction.account);
    if (account) {
      const change = transaction.type === 'income' ? transaction.amount : -transaction.amount;
      account.balance += change * delta;
      await account.save();
    }
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.create({
      user: req.user._id,
      ...req.body,
    });

    await adjustAccountBalance(transaction, 1);
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    await adjustAccountBalance(transaction, -1);
    Object.assign(transaction, req.body);
    const updated = await transaction.save();
    await adjustAccountBalance(updated, 1);

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    await adjustAccountBalance(transaction, -1);
    await transaction.deleteOne();
    res.json({ message: 'Transaction removed' });
  } catch (err) {
    next(err);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { user: req.user._id };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const [totalIncome, totalExpense] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...filter, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...filter, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const income = totalIncome[0]?.total || 0;
    const expense = totalExpense[0]?.total || 0;

    res.json({
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
};
