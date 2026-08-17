const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  exportTransactionsCsv,
  exportTasksCsv,
  exportTransactionsExcel,
  exportTasksExcel,
  exportAllExcel,
  exportAllJson,
} = require('../controllers/exportController');

router.use(protect);

router.get('/transactions', exportTransactionsCsv);
router.get('/transactions/excel', exportTransactionsExcel);
router.get('/tasks', exportTasksCsv);
router.get('/tasks/excel', exportTasksExcel);
router.get('/all', exportAllJson);
router.get('/all/excel', exportAllExcel);

module.exports = router;
