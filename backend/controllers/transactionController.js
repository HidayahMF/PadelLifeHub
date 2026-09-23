const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { getInvestmentCategoryIds } = require('../services/investmentCategoryService');
const {
  createTransactionForUser,
  normalizeTransactionDate,
  sanitizeTransactionBody,
  assertPositiveAmount,
  validateOwnership,
  applyTransfer,
  adjustAccountBalance,
  computeNextRunAt,
} = require('../services/transactionService');

function invalidateCache(userId) {
  try {
    const { invalidateUserCache } = require('../services/aiContext')._cacheUtils;
    if (invalidateUserCache) invalidateUserCache(userId);
  } catch {
    // Non-fatal — cache module may not be loaded yet in test stubs.
  }
}

const getTransactions = async (req, res, next) => {
  try {
    const { type, account, category, financeScope, businessProject, startDate, endDate, search } = req.query;
    const filter = { user: req.user._id };

    if (type) filter.type = type;
    if (account) filter.account = account;
    if (category) filter.category = category;
    if (financeScope === 'personal' || financeScope === 'business') filter.financeScope = financeScope;
    if (businessProject) filter.businessProject = businessProject;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = normalizeTransactionDate(startDate);
      if (endDate) filter.date.$lte = normalizeTransactionDate(endDate);
    }

    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }

    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .populate('category', 'name color icon')
      .populate('account', 'name type currency')
      .populate('fromAccount', 'name type currency')
      .populate('toAccount', 'name type currency');

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
      .populate('account', 'name type currency')
      .populate('fromAccount', 'name type currency')
      .populate('toAccount', 'name type currency');

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    res.json(transaction);
  } catch (err) {
    next(err);
  }
};

const migrateCategoryToBusiness = async (req, res, next) => {
  try {
    const categoryId = String(req.body.categoryId || '').trim();
    const category = await Category.findOne({ _id: categoryId, user: req.user._id, type: 'transaction' }).lean();
    if (!category) { const error = new Error('Transaction category not found'); error.statusCode = 400; throw error; }
    const result = await Transaction.updateMany(
      { user: req.user._id, category: category._id, financeScope: { $ne: 'business' } },
      { $set: { financeScope: 'business' } }
    );
    invalidateCache(req.user._id);
    res.json({ categoryId: String(category._id), categoryName: category.name, modifiedCount: result.modifiedCount ?? result.nModified ?? 0 });
  } catch (err) { next(err); }
};

const createTransaction = async (req, res, next) => {
  try {
    const transaction = await createTransactionForUser(req.user._id, req.body);
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

    const cleanBody = sanitizeTransactionBody(req.body);
    const { account, category, fromAccount, toAccount, businessProject, financeScope, recurring, date, type } = cleanBody;

    const newType = type ?? transaction.type;
    const newAmount = req.body.amount !== undefined ? assertPositiveAmount(req.body.amount) : transaction.amount;

    // Validate the new transfer config BEFORE ownership lookup / balance changes.
    if (newType === 'transfer') {
      const from = fromAccount ?? transaction.fromAccount;
      const to = toAccount ?? transaction.toAccount;
      if (!from || !to || from === to) {
        const err = new Error('Select two different accounts for a transfer');
        err.statusCode = 400;
        throw err;
      }
    }
    const newScope = financeScope ?? transaction.financeScope ?? 'personal';
    if (!['personal', 'business'].includes(newScope)) {
      const err = new Error('Invalid finance scope'); err.statusCode = 400; throw err;
    }
    if (newType === 'transfer' && financeScope !== undefined && financeScope !== 'personal') {
      const err = new Error('Transfers do not have a business or personal expense scope'); err.statusCode = 400; throw err;
    }
    await validateOwnership(req.user._id, { account, category, fromAccount, toAccount, businessProject, financeScope: newScope });

    // Reverse the old effect, then apply the new one.
    if (transaction.type === 'transfer') await applyTransfer(transaction, -1);
    else await adjustAccountBalance(transaction, -1);

    Object.assign(transaction, cleanBody);
    transaction.type = newType;
    transaction.amount = newAmount;
    transaction.financeScope = newScope;
    if (newType === 'transfer' || newScope === 'personal') transaction.businessProject = null;
    // A type switch must not leave stale refs behind: a transfer keeps no
    // income/expense account, and an income/expense keeps no transfer legs.
    if (newType === 'transfer') {
      transaction.account = null;
      transaction.category = null;
    } else {
      transaction.fromAccount = null;
      transaction.toAccount = null;
    }
    if (date !== undefined) transaction.date = normalizeTransactionDate(date);
    if (recurring !== undefined) {
      transaction.recurring = { ...transaction.recurring, ...recurring };
    }
    if (recurring !== undefined || date !== undefined) {
      transaction.nextRunAt = computeNextRunAt(transaction.date, transaction.recurring);
    }
    if (recurring !== undefined && recurring.isRecurring === false) transaction.nextRunAt = null;

    if (transaction.type === 'transfer') await applyTransfer(transaction, 1);
    else await adjustAccountBalance(transaction, 1);

    const updated = await transaction.save();
    invalidateCache(req.user._id);
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

    if (transaction.type === 'transfer') await applyTransfer(transaction, -1);
    else await adjustAccountBalance(transaction, -1);
    await transaction.deleteOne();
    invalidateCache(req.user._id);
    res.json({ message: 'Transaction removed' });
  } catch (err) {
    next(err);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const { startDate, endDate, financeScope } = req.query;
    const filter = { user: req.user._id };
    if (financeScope === 'personal' || financeScope === 'business') filter.financeScope = financeScope;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = normalizeTransactionDate(startDate);
      if (endDate) filter.date.$lte = normalizeTransactionDate(endDate);
    }

    const invCatIds = await getInvestmentCategoryIds(req.user._id);
    const invCatFilter = invCatIds.length ? { category: { $nin: invCatIds } } : {};

    const [totalIncome, totalExpense] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...filter, type: 'income', ...invCatFilter } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...filter, type: 'expense', migratedToInvestment: { $ne: true } } },
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
  migrateCategoryToBusiness,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
};
