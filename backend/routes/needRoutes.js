const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getNeeds,
  createNeed,
  updateNeed,
  deleteNeed,
} = require('../controllers/needController');

router.use(protect);

router.route('/').get(getNeeds).post(createNeed);
router.route('/:id').put(updateNeed).delete(deleteNeed);

module.exports = router;
