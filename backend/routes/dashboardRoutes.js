const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getDashboardSummary,
  getStatistics,
} = require('../controllers/dashboardController');

router.use(protect);

router.get('/summary', getDashboardSummary);
router.get('/statistics', getStatistics);

module.exports = router;
