const Budget = require('../models/Budget');

const getBudgets = async (req, res, next) => {
  try {
    const { month } = req.query;
    const filter = { user: req.user._id };
    if (month) filter.month = month;

    const budgets = await Budget.find(filter)
      .sort({ month: -1 })
      .populate('category', 'name color icon');
    res.json(budgets);
  } catch (err) {
    next(err);
  }
};

const createBudget = async (req, res, next) => {
  try {
    const budget = await Budget.create({
      user: req.user._id,
      ...req.body,
    });
    res.status(201).json(budget);
  } catch (err) {
    next(err);
  }
};

const updateBudget = async (req, res, next) => {
  try {
    const budget = await Budget.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!budget) {
      res.status(404);
      throw new Error('Budget not found');
    }

    Object.assign(budget, req.body);
    const updated = await budget.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteBudget = async (req, res, next) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!budget) {
      res.status(404);
      throw new Error('Budget not found');
    }

    res.json({ message: 'Budget removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getBudgets, createBudget, updateBudget, deleteBudget };
