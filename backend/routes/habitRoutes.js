const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getHabits,
  createHabit,
  updateHabit,
  toggleHabit,
  deleteHabit,
} = require('../controllers/habitController');

router.use(protect);

router.route('/').get(getHabits).post(createHabit);
router.put('/:id/toggle', toggleHabit);
router.route('/:id').put(updateHabit).delete(deleteHabit);

module.exports = router;
