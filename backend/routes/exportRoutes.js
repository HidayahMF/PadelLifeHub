const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  exportTransactionsCsv,
  exportTasksCsv,
  exportAllJson,
} = require('../controllers/exportController');

router.use(protect);

router.get('/transactions', exportTransactionsCsv);
router.get('/tasks', exportTasksCsv);
router.get('/all', exportAllJson);

module.exports = router;
