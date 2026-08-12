const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getToday } = require('../controllers/todayController');

router.use(protect);

router.get('/', getToday);

module.exports = router;
