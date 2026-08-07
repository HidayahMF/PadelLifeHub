const Category = require('../models/Category');

const getCategories = async (req, res, next) => {
  try {
    const { type } = req.query;
    const filter = { user: req.user._id };
    if (type) filter.type = type;
    const categories = await Category.find(filter).sort({ createdAt: 1 });
    res.json(categories);
  } catch (err) {
    next(err);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, color, icon, type } = req.body;
    if (!name) {
      res.status(400);
      throw new Error('Category name is required');
    }
    const category = await Category.create({
      user: req.user._id,
      name,
      color,
      icon,
      type,
    });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!category) {
      res.status(404);
      throw new Error('Category not found');
    }

    Object.assign(category, req.body);
    const updated = await category.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!category) {
      res.status(404);
      throw new Error('Category not found');
    }

    res.json({ message: 'Category removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
