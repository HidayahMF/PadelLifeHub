const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createSession,
  listSessions,
  getStats,
} = require('../controllers/focusSessionController');

router.use(protect);

router.post('/', createSession);
router.get('/stats', getStats);
router.get('/', listSessions);

module.exports = router;
