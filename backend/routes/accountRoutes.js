const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  adjustBalance,
  getAdjustments,
} = require('../controllers/accountController');

router.use(protect);

router.route('/').get(getAccounts).post(createAccount);
router.route('/:id').put(updateAccount).delete(deleteAccount);
router.route('/:id/adjustments').post(adjustBalance).get(getAdjustments);

module.exports = router;