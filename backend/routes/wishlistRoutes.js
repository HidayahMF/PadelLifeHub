const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getWishlistItems,
  createWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
} = require('../controllers/wishlistController');

router.use(protect);

router.route('/').get(getWishlistItems).post(createWishlistItem);
router.route('/:id').put(updateWishlistItem).delete(deleteWishlistItem);

module.exports = router;
