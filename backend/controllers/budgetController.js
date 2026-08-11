const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');

const getBudgets = async (req, res, next) => {
  try {
    const { month } = req.query;
    const filter = { user: req.user._id };
    if (month) filter.month = month;

    const budgets = await Budget.find(filter)
      .sort({ month: -1 })
      .populate('category', 'name color icon');

    // Compute actual spending from transactions so budget progress is real,
    // instead of relying on the stale `spent` column which is never updated.
    // Note: `spent` is refreshed only when the `month` filter is provided;
    // all current callers (dashboard + finance) always pass `month`.
    if (month) {
      const [year, m] = month.split('-').map(Number);
      const monthStart = new Date(year, m - 1, 1);
      const nextMonth = new Date(year, m, 1);

      const spentByCategory = await Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: 'expense',
            date: { $gte: monthStart, $lt: nextMonth },
          },
        },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
      ]);
      const spentMap = new Map(spentByCategory.map((s) => [String(s._id), s.total]));
      const totalSpent = spentByCategory.reduce((sum, s) => sum + s.total, 0);

      for (const budget of budgets) {
        if (budget.category) {
          const id = String(budget.category._id || budget.category);
          budget.spent = spentMap.get(id) ?? 0;
        } else {
          // Overall budget (no category) covers every expense of the month.
          budget.spent = totalSpent;
        }
      }
    }

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
