// Legacy investment migration CLI.
//
//   node scripts/migrate-investments.js                   » BACKUP + DRY-RUN (safe, no writes)
//   node scripts/migrate-investments.js --user <id>        » dry-run for a single user
//   node scripts/migrate-investments.js --apply --user <id> [--ids id1,id2]  » real migration
//   node scripts/migrate-investments.js --rollback --user <id> [--ids invTxId,...]
//
// Order of operations is deliberately safe:
//   1. ALWAYS backs up the complete original records BEFORE any write.
//   2. `--apply` only migrates the explicitly confirmed ids and is idempotent.
//   3. `--rollback` reverses a previous apply without touching unrelated data.
//
// The default (no --apply/--rollback) performs ONLY backup + dry-run analysis
// and never modifies the database.

require('dotenv').config();
const connectDB = require('../config/db');
const {
  analyze,
  backup,
  migrate,
  rollback,
} = require('../services/investmentMigrationService');

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    let k = argv[i];
    let v = true;
    if (k.includes('=')) {
      const eq = k.indexOf('=');
      v = k.slice(eq + 1);
      k = k.slice(0, eq);
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      v = argv[i + 1];
      i++;
    }
    if (k === '--ids') a.ids = String(v).split(',').map((s) => s.trim()).filter(Boolean);
    else a[k] = v;
  }
  return a;
}

function fmtMoney(n) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

async function printReport(analysis) {
  console.log('── LEGACY INVESTMENT MIGRATION — DRY RUN ─────────────────────────');
  console.log(`Exact investment categories detected: ${analysis.exactInvestmentCategoryIds.length.toString()}`);
  console.log(`Transactions to migrate: ${analysis.count}`);
  console.log(`Total amount: Rp ${fmtMoney(analysis.totalAmount)}`);
  if (analysis.dateRange) {
    console.log(`Date range: ${analysis.dateRange.min} → ${analysis.dateRange.max}`);
  }
  if (analysis.byMonth.length) {
    console.log('\nBreakdown per month:');
    for (const m of analysis.byMonth) console.log(`  ${m.month}: Rp ${fmtMoney(m.amount)}`);
  }
  if (analysis.byCategory.length) {
    console.log('\nBreakdown per category (by category id):');
    for (const c of analysis.byCategory) console.log(`  ${c.categoryId}: Rp ${fmtMoney(c.amount)}`);
  }
  if (analysis.ambiguous && analysis.ambiguous.length) {
    console.log('\n⚠ AMBIGUOUS categories (NOT auto-migrated — review manually):');
    for (const c of analysis.ambiguous) console.log(`  ${c._id} "${c.name}"`);
  }
  if (analysis.sample.length) {
    console.log(`\nSample of transactions to migrate (${analysis.sample.length} shown):`);
    for (const s of analysis.sample) {
      console.log(`  ${s.id} | ${s.date} | Rp ${fmtMoney(s.amount)} | ${s.description || '(no note)'}`);
    }
  }
  console.log('──────────────────────────────────────────────────────────────────');
}

async function main() {
  const args = parseArgs(process.argv);
  await connectDB();

  try {
    if (args['--apply']) {
      if (!args['--user'] || !args.ids || !args.ids.length) {
        console.error('ERROR: --apply requires --user <id> and --ids <list of transaction ids>');
        process.exit(1);
      }
      // Backup the exact records being migrated before writing anything.
      const analysis = await analyze(args['--user']);
      const confirmed = analysis.records.filter((r) => args.ids.includes(String(r._id)));
      if (!confirmed.length) {
        console.error('ERROR: none of the supplied ids are eligible legacy investment expenses.');
        process.exit(1);
      }
      const b = await backup(args['--user'], 'apply');
      console.log(`Backup written before migration: ${b.jsonPath}`);
      console.log(`  (${b.count} records)`);

      const result = await migrate(args['--user'], args.ids);
      console.log('── MIGRATION RESULT ─────────────────────────────────────────────');
      console.log(`Migrated: ${result.migrated}`);
      console.log(`Skipped (already migrated / invalid): ${result.skipped}`);
      console.log(`Portfolio: ${result.portfolioId}`);
      console.log(`Created InvestmentTransaction ids: ${result.investmentTransactionIds.join(', ') || 'none'}`);
      console.log('Original transactions preserved and flagged migratedToInvestment=true.');
      process.exit(0);
    }

    if (args['--rollback']) {
      if (!args['--user']) {
        console.error('ERROR: --rollback requires --user <id>');
        process.exit(1);
      }
      const limit = args.ids && args.ids.length ? args.ids : undefined;
      const result = await rollback(args['--user'], limit);
      console.log('── ROLLBACK RESULT ─────────────────────────────────────────────');
      console.log(`Removed InvestmentTransaction records: ${result.removedInvestmentTransactions}`);
      console.log(`Reset original transactions (flag cleared): ${result.originalsReset}`);
      process.exit(0);
    }

    // Default: backup + dry-run across all users (or one user with --user).
    const users = args['--user'] ? [args['--user']] : [];
    if (users.length === 0) {
      const User = require('../models/User');
      const all = await User.find({}).select('_id').lean();
      users.push(...all.map((u) => String(u._id)));
    }
    let grandTotal = 0;
    let grandCount = 0;
    let backups = [];
    for (const uid of users) {
      const analysis = await analyze(uid);
      if (analysis.count === 0) continue;
      const b = await backup(uid, args['--user'] ? 'single' : 'all');
      backups.push(b);
      grandTotal += analysis.totalAmount;
      grandCount += analysis.count;
      console.log(`\nUser ${uid}: ${analysis.count} transactions, Rp ${fmtMoney(analysis.totalAmount)}`);
      await printReport(analysis);
    }
    console.log(`\n=== SUMMARY ===`);
    console.log(`Users scanned: ${users.length}`);
    console.log(`Total legacy investment transactions found: ${grandCount}`);
    console.log(`Grand total amount: Rp ${fmtMoney(grandTotal)}`);
    console.log('Backup files written (complete original records):');
    for (const b of backups) console.log(`  ${b.jsonPath}`);
    console.log('\nNothing was modified (dry run). Review and re-run with --apply --user <id> --ids <ids> to migrate.');
  } finally {
    try {
      const mongoose = require('mongoose');
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
