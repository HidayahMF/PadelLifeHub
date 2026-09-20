const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getJourneyData } = require('../controllers/profileController');

router.use(protect);
router.get('/journey', getJourneyData);

module.exports = router;
