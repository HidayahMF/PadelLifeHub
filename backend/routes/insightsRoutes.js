const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getInsights } = require('../controllers/insightsController');

router.use(protect);

router.get('/', getInsights);

module.exports = router;
