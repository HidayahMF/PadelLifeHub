const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPortfolios,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  getPortfolioDetail,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getOverview,
} = require('../controllers/investmentController');

router.use(protect);

router.get('/overview', getOverview);
router.get('/transactions', getTransactions);
router.post('/transactions', createTransaction);
router.get('/', getPortfolios);
router.post('/', createPortfolio);
router.get('/:id', getPortfolioDetail);
router.put('/:id', updatePortfolio);
router.delete('/:id', deletePortfolio);
router.put('/transactions/:id', updateTransaction);
router.delete('/transactions/:id', deleteTransaction);

module.exports = router;
