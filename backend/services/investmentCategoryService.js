// Shared helper for identifying "investment" categories. Used to exclude legacy
// investment-named records from normal income/expense aggregations WITHOUT
// deleting them (read-time, non-destructive). The migration flag
// (migratedToInvestment) on Transaction is the authoritative marker for
// migrated expense records; the category-name check covers period records that
// have not (or will not) be migrated.

const Category = require('../models/Category');

/** True when a category name is an investment alias (narrow, not substring). */
function isInvestmentCategoryName(name) {
  if (!name) return false;
  const n = String(name).trim().toLowerCase();
  return ['investment', 'investasi', 'invest'].includes(n);
}

/** ObjectIds of the user's transaction categories whose name indicates investment. */
async function getInvestmentCategoryIds(userId) {
  const cats = await Category.find({ user: userId, type: 'transaction' }).select('name');
  return cats.filter((c) => isInvestmentCategoryName(c.name)).map((c) => c._id);
}

module.exports = { isInvestmentCategoryName, getInvestmentCategoryIds };
