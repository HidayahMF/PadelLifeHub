const Need = require('../models/Need');

const getNeeds = async (req, res, next) => {
  try {
    const { shoppingList } = req.query;
    const filter = { user: req.user._id };
    if (shoppingList !== undefined) {
      filter.onShoppingList = shoppingList === 'true';
    }

    const needs = await Need.find(filter).sort({ createdAt: -1 });
    res.json(needs);
  } catch (err) {
    next(err);
  }
};

const createNeed = async (req, res, next) => {
  try {
    const need = await Need.create({
      user: req.user._id,
      ...req.body,
    });
    res.status(201).json(need);
  } catch (err) {
    next(err);
  }
};

const updateNeed = async (req, res, next) => {
  try {
    const need = await Need.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!need) {
      res.status(404);
      throw new Error('Need item not found');
    }

    Object.assign(need, req.body);
    const updated = await need.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteNeed = async (req, res, next) => {
  try {
    const need = await Need.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!need) {
      res.status(404);
      throw new Error('Need item not found');
    }

    res.json({ message: 'Need item removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNeeds, createNeed, updateNeed, deleteNeed };
