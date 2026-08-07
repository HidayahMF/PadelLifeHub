const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
} = require('../controllers/budgetController');

router.use(protect);

router.route('/').get(getBudgets).post(createBudget);
router.route('/:id').put(updateBudget).delete(deleteBudget);

module.exports = router;
