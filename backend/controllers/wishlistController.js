const Wishlist = require('../models/Wishlist');

const getWishlistItems = async (req, res, next) => {
  try {
    const { status, priority, archived, trashed, tag } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (trashed !== undefined) filter.trashed = trashed === 'true';
    else filter.trashed = { $ne: true };
    // Archived items stay out of the default (active) list.
    if (archived !== undefined) filter.archived = archived === 'true';
    else filter.archived = { $ne: true };
    if (tag) filter.tags = tag;

    const items = await Wishlist.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

const createWishlistItem = async (req, res, next) => {
  try {
    const item = await Wishlist.create({
      user: req.user._id,
      ...req.body,
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
};

const updateWishlistItem = async (req, res, next) => {
  try {
    const item = await Wishlist.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!item) {
      res.status(404);
      throw new Error('Wishlist item not found');
    }

    Object.assign(item, req.body);
    if (req.body.savingProgress !== undefined && req.body.savingProgress >= item.price && item.price > 0) {
      item.status = 'purchased';
    }
    const updated = await item.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteWishlistItem = async (req, res, next) => {
  try {
    const item = await Wishlist.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!item) {
      res.status(404);
      throw new Error('Wishlist item not found');
    }

    res.json({ message: 'Wishlist item removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWishlistItems,
  createWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
};
