const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMonthlyReview, aiSummary } = require('../controllers/monthlyReviewController');

router.use(protect);

router.get('/', getMonthlyReview);
router.post('/ai-summary', aiSummary);

module.exports = router;
