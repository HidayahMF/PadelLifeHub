const express = require('express');
const router = express.Router();
const { runAll } = require('../services/scheduler');

/**
 * External cron trigger. Protected by the CRON_SECRET header so strangers
 * cannot force scheduler ticks. Each scheduler job uses atomic claim updates,
 * so overlapping ticks (e.g. retries) are harmless.
 */
router.post('/tick', async (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  const provided = req.get('x-cron-secret') || req.body?.cronSecret;
  if (!secret || provided !== secret) {
    res.status(401);
    return res.json({ success: false, message: 'Unauthorized' });
  }

  try {
    await runAll();
    res.json({ success: true, ran: 'reminder,recurring,task' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
