// Recurring transaction scheduler — turns a recurring transaction into real
// generated transactions at each due occurrence, with idempotency guarantees:
//  - the parent occurrence is claimed atomically (advances nextRunAt) BEFORE a
//    child is created, so a tick restart can never generate a duplicate;
//  - a uniqueness check on (parentRecurringId + date) backs that up.

const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

const TICK_MS = 60 * 1000;

/** Advance a datetime by the recurring frequency (clamped to month end). */
function nextOccurrence(datetime, frequency) {
  const d = new Date(datetime);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') {
    // Move to the same day next month, clamped to the last day of that month
    // (e.g. Jan 31 → Feb 28/29).
    const day = d.getDate();
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    d.setFullYear(next.getFullYear());
    d.setMonth(next.getMonth());
    d.setDate(Math.min(day, lastDay));
  } else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** Apply an income/expense to the linked account balance (user-scoped). */
async function applyToAccount(transaction, delta = 1) {
  if (!transaction.account) return;
  const account = await Account.findOne({ _id: transaction.account, user: transaction.user });
  if (!account) return;
  const change = transaction.type === 'income' ? transaction.amount : -transaction.amount;
  account.balance += change * delta;
  await account.save();
}

async function processRecurringTransactions() {
  const now = new Date();
  const parents = await Transaction.find({
    'recurring.isRecurring': true,
    $or: [{ nextRunAt: { $lte: now } }, { nextRunAt: null }],
  }).limit(200);

  for (const parent of parents) {
    const frequency = parent.recurring.frequency || 'monthly';

    // Determine the occurrence to generate.
    let occurrenceDate;
    if (parent.nextRunAt) {
      occurrenceDate = new Date(parent.nextRunAt);
    } else {
      // Legacy recurring transaction without a schedule — derive from its date.
      occurrenceDate = nextOccurrence(parent.date || new Date(), frequency);
    }

    // Atomic claim: advance the schedule immediately.
    const claimed = await Transaction.findOneAndUpdate(
      {
        _id: parent._id,
        'recurring.isRecurring': true,
        nextRunAt: parent.nextRunAt || null,
      },
      {
        $set: {
          nextRunAt: nextOccurrence(occurrenceDate, frequency),
          lastRunAt: new Date(),
        },
      },
      { new: true }
    );
    if (!claimed) continue;

    // Second idempotency guard.
    const existing = await Transaction.findOne({
      user: parent.user,
      parentRecurringId: parent._id,
      date: occurrenceDate,
    });
    if (existing) continue;

    try {
      const child = await Transaction.create({
        user: parent.user,
        type: parent.type,
        amount: parent.amount,
        description: parent.description,
        category: parent.category,
        account: parent.account,
        date: occurrenceDate,
        recurring: { isRecurring: false, frequency: null },
        parentRecurringId: parent._id,
      });
      await applyToAccount(child, 1);
      console.log(
        `[scheduler] recurring transaction generated: ${parent.description || parent.type} ${parent.amount}`
      );
    } catch (err) {
      console.error(`[scheduler] recurring generation failed: ${err.message}`);
    }
  }
}

async function tick() {
  try {
    await processRecurringTransactions();
  } catch (err) {
    console.error(`[scheduler] recurring error: ${err.message}`);
  }
}

let interval = null;

function startRecurringScheduler() {
  if (interval) return;
  tick();
  interval = setInterval(tick, TICK_MS);
  console.log('[scheduler] recurring transaction scheduler started');
}

module.exports = { startRecurringScheduler, tick, nextOccurrence };
