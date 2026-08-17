// Deterministic query router — answers simple lookup questions directly from
// the database WITHOUT calling Gemini.
//
// Returns { handled: true, reply } when the query is confidently understood,
// or { handled: false } to signal a Gemini fallback.
//
// Every query is user-scoped via the provided userId — never from request body.

const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { computeNetWorth } = require('./aiContext');

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const fmt = (n) => IDR.format(Number(n) || 0);

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalize(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Match an account name from user query text against the user's own accounts.
 * Uses progressively looser matching: exact → normalized → token suffix.
 * Returns { account, ambiguous }.
 *
 * Security: accounts are ALREADY scoped to the authenticated user via
 * Account.find({ user: userId }) before this function is called. No global
 * lookup is performed. "BCA" can never reach another user's accounts.
 *
 * The token suffix step (3) extracts word tokens from the query and checks
 * whether any account name ends with a token at a word boundary. This lets
 * "BCA" resolve to "Bank BCA" while preventing false matches like "ca"
 * matching "BCA" (the token must be a meaningful word-level suffix).
 */
function matchAccount(text, accounts) {
  const lower = text.toLowerCase();
  // 1. Exact case-insensitive: query includes the full account name
  let hits = accounts.filter((a) => lower.includes(String(a.name).toLowerCase()));
  if (hits.length === 1) return { account: hits[0], ambiguous: false };
  if (hits.length > 1) {
    // Try normalized match to disambiguate
    const normText = normalize(text);
    hits = accounts.filter((a) => normalize(a.name) === normText);
    if (hits.length === 1) return { account: hits[0], ambiguous: false };
    return { account: null, ambiguous: true };
  }

  // 2. Normalized exact
  const normText = normalize(text);
  hits = accounts.filter((a) => normalize(a.name) === normText);
  if (hits.length === 1) return { account: hits[0], ambiguous: false };
  if (hits.length > 1) return { account: null, ambiguous: true };

  // 3. Token suffix match — extract word tokens from the query text and
  //    check whether any account name ends with a token at a word boundary.
  //    This lets "BCA" resolve to "Bank BCA" without weakening user scoping.
  //    Tokens must be >= 3 characters to prevent false matches on short
  //    substrings like "ca" or "di".
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  if (tokens.length > 0) {
    hits = accounts.filter((a) =>
      tokens.some((token) => accountEndsWithToken(a.name, token))
    );
    if (hits.length === 1) return { account: hits[0], ambiguous: false };
    if (hits.length > 1) return { account: null, ambiguous: true };
  }

  return { account: null, ambiguous: false };
}

/**
 * Check if accountName ends with token at a word boundary.
 * Uses the ORIGINAL account name (not normalized) so separators like
 * spaces, hyphens, ampersands etc. act as natural word boundaries.
 *
 * "Bank BCA" endsWithToken("bca") → true  (preceded by space)
 * "Bank BCA" endsWithToken("ca")  → false (preceded by 'b', mid-word)
 * "GoPay"    endsWithToken("gopay") → true (full name)
 * "GoPay"    endsWithToken("pay")  → false (preceded by 'o', mid-word)
 */
function accountEndsWithToken(accountName, token) {
  const lower = String(accountName || '').toLowerCase();
  if (!lower.endsWith(token)) return false;
  const before = lower.slice(0, lower.length - token.length);
  if (before.length === 0) return true; // token IS the full name
  return /[^a-z0-9]/.test(before[before.length - 1]);
}

/**
 * Match a category name from user query text against the user's categories.
 */
function matchCategory(text, categories) {
  const lower = text.toLowerCase();
  let hits = categories.filter((c) => lower.includes(String(c.name).toLowerCase()));
  if (hits.length === 1) return { category: hits[0], ambiguous: false };
  if (hits.length > 1) {
    const normText = normalize(text);
    hits = categories.filter((c) => normalize(c.name) === normText);
    if (hits.length === 1) return { category: hits[0], ambiguous: false };
    hits = categories.filter((c) => {
      const cn = normalize(c.name);
      return cn && (cn.includes(normText) || normText.includes(cn));
    });
    if (hits.length === 1) return { category: hits[0], ambiguous: false };
    return { category: null, ambiguous: true };
  }
  return { category: null, ambiguous: false };
}

// ── Intent patterns ─────────────────────────────────────────────────────────

// Each pattern: { re, intent, extract? }
// intent ∈ { 'account_balance', 'total_balance', 'net_worth', 'liquid', 'investment',
//             'month_expense', 'month_income', 'account_expense', 'category_expense',
//             'recent_transactions', 'tx_count' }

const INTENT_PATTERNS = [
  // ── Total balance / net worth (MUST come before account_balance to avoid
  //    "total saldo saya?" matching "saldo (.+)" as account lookup) ──
  {
    re: /total\s+(?:saldo|balance|uang|keuangan)/i,
    intent: 'total_balance',
  },
  {
    re: /(?:berapa\s+)?total\s+(?:saldo|balance)/i,
    intent: 'total_balance',
  },
  {
    re: /saldo\s+(?:saya\s+)?total/i,
    intent: 'total_balance',
  },
  {
    re: /(?:seluruh|semua)\s+(?:saldo|rekening|uang)/i,
    intent: 'total_balance',
  },
  {
    re: /net\s*worth/i,
    intent: 'net_worth',
  },
  {
    re: /kekayaan\s+(?:bersih|saya)/i,
    intent: 'net_worth',
  },
  {
    re: /berapa\s+(?:kekayaan|net\s*worth)/i,
    intent: 'net_worth',
  },

  // ── Liquid / investment ──
  {
    re: /(?:berapa\s+)?liquid\s*(?:assets?|uang\s+cair)/i,
    intent: 'liquid',
  },
  {
    re: /uang\s+cair/i,
    intent: 'liquid',
  },
  {
    re: /(?:berapa\s+)?(?:investasi|investment)/i,
    intent: 'investment',
  },
  {
    re: /(?:total\s+)?(?:investasi|investment)\s+(?:saya)?/i,
    intent: 'investment',
  },

  // ── Monthly expense / income (MUST come before account/category expense
  //    to prevent "berapa pengeluaran bulan ini?" matching account_expense) ──
  {
    re: /(?:berapa\s+)?(?:pengeluaran|expense|belanja|spending)\s+(?:bulan\s+ini|this\s+month)/i,
    intent: 'month_expense',
  },
  {
    re: /(?:pengeluaran|expense|belanja)\s+(?:saya\s+)?(?:bulan\s+ini)/i,
    intent: 'month_expense',
  },
  {
    re: /(?:berapa\s+)?(?:pengeluaran|expense|belanja|spending)\s*$/i,
    intent: 'month_expense',
  },
  {
    re: /(?:berapa\s+)?(?:pemasukan|income|gaji|penghasilan)\s+(?:bulan\s+ini|this\s+month)?/i,
    intent: 'month_income',
  },
  {
    re: /(?:pemasukan|income|gaji)\s+(?:saya\s+)?(?:bulan\s+ini)/i,
    intent: 'month_income',
  },

  // ── Account-specific expense ──
  // "berapa pengeluaran BCA?", "expense dari BCA"
  {
    re: /(?:berapa\s+)?(?:pengeluaran|expense|belanja|spending)\s+(?:dari\s+|di\s+|pakai\s+|gunakan\s+)?(.+)/i,
    intent: 'account_expense',
    extract: (m) => m[1],
  },

  // ── Category-specific expense ──
  // "berapa pengeluaran Food & Drinks?", "belanja makan berapa"
  {
    re: /(?:berapa\s+)?(?:pengeluaran|expense|belanja|spending)\s+(?:kategori\s+|category\s+)?(.+?)(?:\s+bulan\s+ini)?$/i,
    intent: 'category_expense',
    extract: (m) => m[1],
  },

  // ── Recent transactions ──
  {
    re: /(?:transaksi|transaction|riwayat)\s+(?:terakhir|recent|latest|last)/i,
    intent: 'recent_transactions',
  },
  {
    re: /(?:apa\s+(?:saja\s+)?transaksi|transaction)\s+(?:yang\s+)?(?:terakhir|recent)/i,
    intent: 'recent_transactions',
  },
  {
    re: /(?:last|recent|terakhir)\s+(?:\d+\s+)?(?:transaksi|transaction)/i,
    intent: 'recent_transactions',
  },

  // ── Transaction count ──
  {
    re: /(?:berapa\s+)?(?:transaksi|transaction)\s+(?:bulan\s+ini|this\s+month)/i,
    intent: 'tx_count',
  },
  {
    re: /(?:jumlah|count|total)\s+(?:transaksi|transaction)/i,
    intent: 'tx_count',
  },

  // ── Account balance (MUST come after total_balance / aggregate patterns) ──
  // "berapa saldo BCA", "saldo BCA berapa", "bca ada berapa", "uang di bca"
  {
    re: /(?:berapa\s+)?saldo\s+(.+)/i,
    intent: 'account_balance',
    extract: (m) => m[1],
  },
  {
    re: /saldo\s+(?:rekening\s+)?(.+?)(?:\s+berapa)?\s*$/i,
    intent: 'account_balance',
    extract: (m) => m[1],
  },
  {
    re: /(.+?)\s+(?:saya\s+)?(?:ada\s+)?berapa\s*$/i,
    intent: 'account_balance',
    extract: (m) => m[1],
  },
  {
    re: /uang\s+di\s+(.+)/i,
    intent: 'account_balance',
    extract: (m) => m[1],
  },
  {
    re: /balance\s+(.+)/i,
    intent: 'account_balance',
    extract: (m) => m[1],
  },
  {
    re: /(.+?)\s+balance/i,
    intent: 'account_balance',
    extract: (m) => m[1],
  },
];

// ── Query handler ───────────────────────────────────────────────────────────

/**
 * Try to answer a chat query deterministically.
 * @param {string} userId - authenticated user's MongoDB ObjectId (string)
 * @param {string} message - user's chat message
 * @returns {Promise<{ handled: boolean, reply?: string }>}
 */
async function handleQuery(userId, message) {
  const text = String(message || '').trim();
  if (!text || text.length < 3) return { handled: false };

  // Match intent
  let intent = null;
  let rawExtract = null;
  for (const pat of INTENT_PATTERNS) {
    const m = text.match(pat.re);
    if (m) {
      intent = pat.intent;
      rawExtract = pat.extract ? pat.extract(m) : null;
      break;
    }
  }

  if (!intent) return { handled: false };

  // Load user's accounts (needed for most intents)
  const accounts = await Account.find({ user: userId }).sort({ name: 1 });

  // ── Route by intent ──

  if (intent === 'account_balance') {
    if (!rawExtract) return { handled: false };
    const { account, ambiguous } = matchAccount(rawExtract, accounts);
    if (ambiguous) {
      return {
        handled: true,
        reply: 'Ada beberapa rekening yang cocok. Sebutkan nama rekening yang lebih spesifik.',
      };
    }
    if (!account) return { handled: false };
    console.log('[AI] deterministic lookup — account balance');
    return {
      handled: true,
      reply: `${account.name} memiliki saldo ${fmt(account.balance)}.`,
    };
  }

  if (intent === 'total_balance') {
    const total = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    console.log('[AI] deterministic lookup — total balance');
    return {
      handled: true,
      reply: `Total saldo seluruh rekening Anda adalah ${fmt(total)}.`,
    };
  }

  if (intent === 'net_worth') {
    const netWorth = computeNetWorth(accounts);
    console.log('[AI] deterministic lookup — net worth');
    return {
      handled: true,
      reply:
        `Total kekayaan bersih (net worth) Anda adalah ${fmt(netWorth.total)}.\n\n` +
        `- Liquid (cash + bank + e-wallet): ${fmt(netWorth.liquid)}\n` +
        `- Investasi: ${fmt(netWorth.investment)}` +
        (netWorth.byType.length > 0
          ? '\n\nPerincian per jenis:\n' +
            netWorth.byType.map((t) => `- ${t.type}: ${fmt(t.balance)}`).join('\n')
          : ''),
    };
  }

  if (intent === 'liquid') {
    const netWorth = computeNetWorth(accounts);
    console.log('[AI] deterministic lookup — liquid assets');
    return {
      handled: true,
      reply: `Total liquid assets (cash + bank + e-wallet) Anda adalah ${fmt(netWorth.liquid)}.`,
    };
  }

  if (intent === 'investment') {
    const netWorth = computeNetWorth(accounts);
    console.log('[AI] deterministic lookup — investment');
    return {
      handled: true,
      reply: `Total investasi Anda adalah ${fmt(netWorth.investment)}.`,
    };
  }

  if (intent === 'month_expense') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [row] = await Transaction.aggregate([
      { $match: { user: userId, type: 'expense', date: { $gte: monthStart, $lt: nextMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const total = row?.total || 0;
    const count = row?.count || 0;
    console.log('[AI] deterministic lookup — month expense');
    return {
      handled: true,
      reply:
        count > 0
          ? `Pengeluaran bulan ini adalah ${fmt(total)} dari ${count} transaksi.`
          : 'Belum ada pengeluaran bulan ini.',
    };
  }

  if (intent === 'month_income') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [row] = await Transaction.aggregate([
      { $match: { user: userId, type: 'income', date: { $gte: monthStart, $lt: nextMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const total = row?.total || 0;
    const count = row?.count || 0;
    console.log('[AI] deterministic lookup — month income');
    return {
      handled: true,
      reply:
        count > 0
          ? `Pemasukan bulan ini adalah ${fmt(total)} dari ${count} transaksi.`
          : 'Belum ada pemasukan bulan ini.',
    };
  }

  if (intent === 'account_expense') {
    if (!rawExtract) return { handled: false };
    const { account, ambiguous } = matchAccount(rawExtract, accounts);
    if (ambiguous) {
      return {
        handled: true,
        reply: 'Ada beberapa rekening yang cocok. Sebutkan nama rekening yang lebih spesifik.',
      };
    }
    if (!account) return { handled: false };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [row] = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: monthStart, $lt: nextMonth },
          account: account._id,
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const total = row?.total || 0;
    const count = row?.count || 0;
    console.log('[AI] deterministic lookup — account expense');
    return {
      handled: true,
      reply:
        count > 0
          ? `Pengeluaran dari ${account.name} bulan ini adalah ${fmt(total)} dari ${count} transaksi.`
          : `Belum ada pengeluaran dari ${account.name} bulan ini.`,
    };
  }

  if (intent === 'category_expense') {
    if (!rawExtract) return { handled: false };
    const categories = await Category.find({ user: userId, type: 'transaction' });
    const { category, ambiguous } = matchCategory(rawExtract, categories);
    if (ambiguous) {
      return {
        handled: true,
        reply: 'Ada beberapa kategori yang cocok. Sebutkan nama kategori yang lebih spesifik.',
      };
    }
    if (!category) return { handled: false };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [row] = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'expense',
          date: { $gte: monthStart, $lt: nextMonth },
          category: category._id,
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const total = row?.total || 0;
    const count = row?.count || 0;
    console.log('[AI] deterministic lookup — category expense');
    return {
      handled: true,
      reply:
        count > 0
          ? `Pengeluaran kategori "${category.name}" bulan ini adalah ${fmt(total)} dari ${count} transaksi.`
          : `Belum ada pengeluaran di kategori "${category.name}" bulan ini.`,
    };
  }

  if (intent === 'recent_transactions') {
    const txs = await Transaction.find({ user: userId })
      .sort({ date: -1 })
      .limit(5)
      .populate('category', 'name')
      .populate('account', 'name');
    if (!txs.length) {
      console.log('[AI] deterministic lookup — recent transactions (empty)');
      return {
        handled: true,
        reply: 'Belum ada transaksi yang tercatat.',
      };
    }
    console.log('[AI] deterministic lookup — recent transactions');
    const lines = txs.map((t) => {
      const date = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(t.date));
      const cat = t.category?.name ?? '';
      const acc = t.account?.name ?? '';
      return `- ${date} | ${t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer'} | ${(t.description || cat || 'transaction').slice(0, 40)} | ${fmt(t.amount)}` +
        (cat ? ` | kategori: ${cat}` : '') +
        (acc ? ` | rekening: ${acc}` : '');
    });
    return {
      handled: true,
      reply: `5 transaksi terakhir:\n${lines.join('\n')}`,
    };
  }

  if (intent === 'tx_count') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const count = await Transaction.countDocuments({
      user: userId,
      date: { $gte: monthStart, $lt: nextMonth },
    });
    console.log('[AI] deterministic lookup — tx count');
    return {
      handled: true,
      reply:
        count > 0
          ? `Ada ${count} transaksi bulan ini.`
          : 'Belum ada transaksi bulan ini.',
    };
  }

  // Not handled
  return { handled: false };
}

module.exports = { handleQuery, matchAccount, matchCategory, fmt };
