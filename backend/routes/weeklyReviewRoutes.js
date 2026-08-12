const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getWeeklyReview, saveWeeklyReview } = require('../controllers/weeklyReviewController');

router.use(protect);

router.get('/', getWeeklyReview);
router.put('/', saveWeeklyReview);

module.exports = router;
