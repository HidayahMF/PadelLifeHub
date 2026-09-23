const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getTransactions,
  getTransactionById,
  migrateCategoryToBusiness,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
} = require('../controllers/transactionController');

router.use(protect);

router.get('/summary', getSummary);
router.post('/migrate-category-to-business', migrateCategoryToBusiness);
router.route('/').get(getTransactions).post(createTransaction);
router.route('/:id').get(getTransactionById).put(updateTransaction).delete(deleteTransaction);

module.exports = router;
