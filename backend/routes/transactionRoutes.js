const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
} = require('../controllers/transactionController');

router.use(protect);

router.get('/summary', getSummary);
router.route('/').get(getTransactions).post(createTransaction);
router.route('/:id').get(getTransactionById).put(updateTransaction).delete(deleteTransaction);

module.exports = router;
