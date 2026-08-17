// Natural-language transaction parsing + confirmation for the Finance
// Quick Add feature.
//
// parseTransaction(userId, message)  — READ ONLY. Calls Gemini to extract a
//   transaction intent, resolves account/category names against the USER'S
//   own data, and returns a draft. It never writes to the database.
//
// createTransaction(userId, draft)   — the ONLY write path. Re-validates every
//   field (ownership, amount, type, transfer legs) and then creates the
//   transaction through transactionService.createTransactionForUser — the same
//   service used by the manual POST /api/transactions endpoint, so account
//   balance math is identical everywhere.

const Account = require('../models/Account');
const Category = require('../models/Category');
const { generate } = require('./geminiService');
const transactionService = require('./transactionService');

const MAX_CATEGORY_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 100;

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const fmtIDR = (n) => IDR.format(Number(n) || 0);

/** Strict JSON schema the model MUST return for every parse request. */
const TRANSACTION_PARSER_SYSTEM_PROMPT = `You are the transaction parser inside the LifeHub Finance quick-add feature.

The user types a short, natural-language message that describes a financial transaction to record (e.g. "jajan 15k bca", "gajian 5jt bca", "transfer 100k bni ke gopay", "isi gopay 100rb dari bni", "top up gopay 100rb pakai bca", "pindah 500k dari dana ke bni").

Your job is to decide whether the message is a transaction, a question, or needs clarification, and then output ONE strict JSON object with EXACTLY this schema (no markdown fences, no extra text, no comments):

{"intent":"transaction"|"question"|"clarify","type":"income"|"expense"|"transfer"|null,"amount":number|null,"description":string|null,"category":string|null,"fromAccount":string|null,"toAccount":string|null,"account":string|null,"reply":string}

Rules:
1. intent:
   - "transaction" when the message clearly describes recording money.
   - "question" when the user is asking about data (e.g. "berapa saldo bca?"). NEVER turn a question into a transaction.
   - "clarify" when essential information is missing or ambiguous.
2. amount: always a positive INTEGER rupiah value computed correctly. "15k"/"15rb"/"15 ribu" = 15000. "1jt"/"1 juta" = 1000000. "1,5jt"/"1.5jt" = 1500000. "5.000.000" = 5000000. If there is no amount, set amount to null and intent to "clarify".
3. Transfer detection: words like transfer, pindah, top up / topup, isi / isi saldo, kirim, mindahin, pindahkan indicate a TRANSFER. Set type="transfer" and fill fromAccount (source) and toAccount (destination):
   - "transfer 100k bni ke gopay" -> fromAccount="Bank BNI", toAccount="GoPay"
   - "isi gopay 100k dari bni" -> fromAccount="Bank BNI", toAccount="GoPay"
   - "top up gopay 100rb pakai bca" -> fromAccount="Bank BCA", toAccount="GoPay"
   - "pindah 500k dari dana ke bni" -> fromAccount="Dana", toAccount="Bank BNI"
   If a transfer is missing its source or destination, set intent to "clarify".
4. income/expense: fill "account" (the single account). If no account can be identified, set intent to "clarify".
5. Use account names EXACTLY as listed in the "Accounts" section of the prompt, or null when absent.
6. category: pick the closest matching name from the "Categories" section of the prompt, or null when nothing fits. Prefer "Food & Drinks" for food/drinks/snacks/coffee (jajan, makan, kopi, sarapan, makan siang, makan malam, minuman).
7. description: a short label (e.g. "Jajan", "Gaji", "Kopi", "Transfer").
8. reply: Indonesian short text. For intent "transaction" -> a short confirmation. For "clarify" -> ask ONLY for the missing piece, e.g. "Mau dipotong dari rekening mana?", "Berapa nominal transaksinya?", "Transfer dari rekening mana?", "Transfer ke rekening mana?".`;

/**
 * Deterministic keyword → category fallback. The AI model is asked to pick the
 * closest category, but it may return null (or invent a name that does not
 * exist). So when no suggestion comes back we map the message itself to one of
 * the standard categories. Kept deliberately conservative — it only runs when
 * the model gave no category at all.
 */
const CATEGORY_KEYWORDS = [
  {
    name: 'Food & Drinks',
    re: /jajan|makan|makanan|kopi|sarapan|minum|minuman|snack|cemilan|gorengan|nasi|ayam|mie|bakmi|bakso|sate|kebab|burger|pizza|restoran|warung|cafe|caf[eé]|coffee|lunch|dinner|breakfast|teh|bubble|eskrim|roti|kue|lapar|laper|ngemil|makan siang|makan malam/i,
  },
  {
    name: 'Transport',
    re: /bensin|bbm|pertalite|pertamax|ojek|grab|gojek|maxim|taksi|transport|angkot|tol|parkir|bengkel|servis|ganti oli/i,
  },
  {
    name: 'Bills',
    re: /listrik|token listrik|pdam|bayar air|tagihan air|pulsa|internet|wifi|televisi|tv kabel|tagihan|bpjs|paket data/i,
  },
  {
    name: 'Shopping',
    re: /belanja|baju|sepatu|tas|kosmetik|skincare|shopee|tokopedia|marketplace|barang|gadget|ponsel|smartphone|elektronik|rumah tangga/i,
  },
  {
    name: 'Entertainment',
    re: /nonton|netflix|spotify|game|steam|bioskop|musik|konser|youtube|hiburan/i,
  },
  {
    name: 'Health',
    re: /obat|apotek|klinik|dokter|vitamin|rumah sakit|berobat|konsul|kesehatan/i,
  },
  {
    name: 'Salary',
    re: /gaji|gajian|salary|upah|honor/i,
  },
];

function guessCategory(text) {
  const t = String(text || '').toLowerCase();
  const hit = CATEGORY_KEYWORDS.find((k) => k.re.test(t));
  return hit ? hit.name : null;
}

/** Pull a code-fenced or prose JSON object out of a model reply. */
function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  candidate = candidate.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/** Normalize a name for comparison: lowercase, no punctuation/spaces. */
function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '');
}

/**
 * Resolve an account from the user's own account list using progressively
 * looser matching: exact (case-insensitive) → normalized → contains.
 * Returns { account, ambiguous }.
 */
function resolveAccount(accounts, query) {
  if (!query || !accounts.length) return { account: null, ambiguous: false };
  const qRaw = String(query).trim();
  const q = normalizeName(qRaw);
  if (!q) return { account: null, ambiguous: false };

  let matches = accounts.filter((a) => String(a.name).toLowerCase() === qRaw.toLowerCase());
  if (matches.length === 1) return { account: matches[0], ambiguous: false };
  if (matches.length > 1) return { account: null, ambiguous: true };

  matches = accounts.filter((a) => normalizeName(a.name) === q);
  if (matches.length === 1) return { account: matches[0], ambiguous: false };
  if (matches.length > 1) return { account: null, ambiguous: true };

  // Security: only use "contains" fallback when query >= 4 normalized chars
  // to prevent short abbreviations like "bca" matching compound names.
  if (q.length >= 4) {
    matches = accounts.filter((a) => {
      const an = normalizeName(a.name);
      return an && (an.includes(q) || q.includes(an));
    });
    if (matches.length === 1) return { account: matches[0], ambiguous: false };
    if (matches.length > 1) return { account: null, ambiguous: true };
  }

  return { account: null, ambiguous: false };
}

/**
 * Resolve a category from the user's own transaction categories.
 * Returns { category (document|null), name (matched name or the raw suggestion) }.
 */
function resolveCategory(categories, suggestion) {
  if (!suggestion) return { category: null, name: null };
  const s = String(suggestion).trim();
  const q = normalizeName(s);
  if (!q) return { category: null, name: null };

  const match =
    categories.find((c) => String(c.name).toLowerCase() === s.toLowerCase()) ||
    categories.find((c) => normalizeName(c.name) === q) ||
    categories.find((c) => {
      const cn = normalizeName(c.name);
      return cn && (cn.includes(q) || q.includes(cn));
    });
  if (match) return { category: match, name: match.name };
  return { category: null, name: s.slice(0, MAX_CATEGORY_NAME_LENGTH) };
}

/** Convert a raw AI amount value into a positive IDR integer, or null. */
function normalizeAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s || s.includes('-')) return null;
    const isRibu = /(^|\s|\d)(rb|k)\b/i.test(s) || /ribu/i.test(s);
    const isJuta = /jt\b|juta/i.test(s);
    const isMiliar = /miliar|milyar/i.test(s);
    const numStr = s.replace(/[^\d.,]/g, '').trim();
    if (!numStr) return null;

    const hasDot = numStr.includes('.');
    const hasComma = numStr.includes(',');
    let num;

    if (hasDot && hasComma) {
      num = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    } else if (hasDot) {
      const parts = numStr.split('.');
      const isThousands = parts.length > 1 && parts[1].length === 3 && !isJuta && !isRibu && !isMiliar;
      num = isThousands ? parseFloat(numStr.replace(/\./g, '')) : parseFloat(numStr);
    } else if (hasComma) {
      const parts = numStr.split(',');
      const isThousands = parts.length > 1 && parts[1].length === 3 && !isJuta && !isRibu && !isMiliar;
      num = isThousands ? parseFloat(numStr.replace(/,/g, '')) : parseFloat(numStr.replace(',', '.'));
    } else {
      num = parseFloat(numStr);
    }

    if (!Number.isFinite(num) || num <= 0) return null;
    if (isRibu) num *= 1000;
    if (isJuta) num *= 1e6;
    if (isMiliar) num *= 1e9;
    num = Math.round(num);
    return num > 0 ? num : null;
  }
  return null;
}

function cleanDescription(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  return s.slice(0, MAX_DESCRIPTION_LENGTH);
}

function buildPrompt(message, accounts, categories) {
  const accountLines = accounts.map((a) => `- ${a.name} (${a.type})`).join('\n');
  const categoryLines = categories.length
    ? categories.map((c) => `- ${c.name}`).join('\n')
    : '- (none yet)';
  return `Accounts:\n${accountLines}\n\nCategories:\n${categoryLines}\n\nUser message: "${message}"`;
}

// ── Deterministic quick-add parser ───────────────────────────────────────────
// Attempts to parse simple, pattern-based transaction messages without calling
// Gemini. Returns a draft object or null (null = fall back to Gemini).

/** Parse an IDR amount string like "15k", "1.5jt", "15rb", "50000", "15.000". */
function parseAmount(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const isRibu = /(?:rb|k|ribu)\b/i.test(s);
  const isJuta = /(?:jt|juta)\b/i.test(s);
  const isMiliar = /(?:miliar|milyar)\b/i.test(s);
  const numStr = s.replace(/[^\d.,]/g, '').trim();
  if (!numStr) return null;

  const hasDot = numStr.includes('.');
  const hasComma = numStr.includes(',');
  let num;

  if (hasDot && hasComma) {
    num = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
  } else if (hasDot) {
    const parts = numStr.split('.');
    const isThousands = parts.length > 1 && parts[1].length === 3 && !isJuta && !isRibu && !isMiliar;
    num = isThousands ? parseFloat(numStr.replace(/\./g, '')) : parseFloat(numStr);
  } else if (hasComma) {
    const parts = numStr.split(',');
    const isThousands = parts.length > 1 && parts[1].length === 3 && !isJuta && !isRibu && !isMiliar;
    num = isThousands ? parseFloat(numStr.replace(/,/g, '')) : parseFloat(numStr.replace(',', '.'));
  } else {
    num = parseFloat(numStr);
  }

  if (!Number.isFinite(num) || num <= 0) return null;
  if (isRibu) num *= 1000;
  if (isJuta) num *= 1e6;
  if (isMiliar) num *= 1e9;
  num = Math.round(num);
  return num > 0 ? num : null;
}

/**
 * Try to parse a simple transaction message deterministically.
 *
 * Supported patterns:
 *   expense:  "[desc] [amount] [account]"      e.g. "jajan 15k bca"
 *   income:   "[desc] [amount] [account]"      e.g. "gajian 5jt bca"
 *   transfer: "transfer [amount] [from] ke [to]" e.g. "transfer 100k bni ke gopay"
 *
 * Returns { type, amount, description, account/fromAccount/toAccount } or null.
 */
function deterministicParse(message, accounts) {
  const text = String(message || '').trim();
  if (!text || text.length < 3) return null;

  // ── Transfer pattern ──
  // "transfer 100k bni ke gopay", "transfer 100k dari bni ke gopay"
  const transferRe = /^transfer(?:\s+(?:dari|dari\s+rekening|rekening))?\s+([\d.,]+(?:\s*(?:rb|k|ribu|jt|juta|miliar|milyar))?)\s+(.+?)\s+(?:ke|to|ke\s+rekening)\s+(.+)$/i;
  const txMatch = text.match(transferRe);
  if (txMatch) {
    const amount = parseAmount(txMatch[1]);
    if (!amount) return null;
    const fromName = txMatch[2].trim();
    const toName = txMatch[3].trim();
    if (!fromName || !toName) return null;
    return { type: 'transfer', amount, fromAccount: fromName, toAccount: toName };
  }

  // ── Income keywords ──
  const INCOME_KEYWORDS = /^(?:gajian|gaji|salary|income|masuk|pemasukan|penjualan|bonus|fee|honor|upah|pendapatan|transfer\s+masuk)/i;
  const isIncome = INCOME_KEYWORDS.test(text);

  // ── Expense keywords (conservative — must be clearly a spend) ──
  const EXPENSE_KEYWORDS = /^(?:jajan|makan|beli|bayar|belanja|isi\s+saldo|top\s*up|充|topup|isi|spend|expense|beli\s+token|beli\s+pulsa|beli\s+listrik|beli\s+bensin|nonton|sewa|sewaan|donasi|donate|sumbangan|bayar\s+listrik|bayar\s+air|bayar\s+wifi|bayar\s+internet|bayar\s+bpjs|bayar\s+tagihan|sewa|sewaan|sewa\s+kos|sewa\s+rumah)/i;
  const isExpense = isIncome ? false : EXPENSE_KEYWORDS.test(text);

  // ── Generic pattern: [description] [amount] [account] ──
  // Try to extract: description (word(s)) + amount + account (word(s))
  // Examples: "jajan 15k bca", "beli pulsa 50k mandiri", "gajian 5jt bca"
  // The amount is always the numeric part.

  // Match: everything before the number = description, the number = amount, everything after = account
  const GENERIC_RE = /^(.+?)\s+([\d.,]+(?:\s*(?:rb|k|ribu|jt|juta|miliar|milyar))?)\s+(.+?)$/i;
  const genMatch = text.match(GENERIC_RE);
  if (genMatch) {
    const descRaw = genMatch[1].trim();
    const amount = parseAmount(genMatch[2]);
    const accRaw = genMatch[3].trim();
    if (amount && accRaw) {
      // Determine type
      let type = 'expense';
      if (isIncome) type = 'income';

      // Clean description — capitalize first letter
      const desc = descRaw.charAt(0).toUpperCase() + descRaw.slice(1);
      return { type, amount, description: desc, account: accRaw };
    }
  }

  // ── Fallback: no amount found → cannot determine deterministically ──
  return null;
}

/**
 * Try deterministic parse, resolve accounts/categories, build draft.
 * Returns draft object (with intent: 'transaction') or null.
 */
function tryDeterministicQuickAdd(message, accounts, categories) {
  const parsed = deterministicParse(message, accounts);
  if (!parsed) return null;

  if (parsed.type === 'transfer') {
    const fromRes = resolveAccount(accounts, parsed.fromAccount);
    const toRes = resolveAccount(accounts, parsed.toAccount);
    if (fromRes.ambiguous || toRes.ambiguous) return null;
    if (!fromRes.account || !toRes.account) return null;
    if (fromRes.account._id && toRes.account._id && String(fromRes.account._id) === String(toRes.account._id)) return null;
    return {
      intent: 'transaction',
      draft: {
        type: 'transfer',
        amount: parsed.amount,
        description: 'Transfer',
        fromAccountId: fromRes.account._id,
        fromAccountName: fromRes.account.name,
        toAccountId: toRes.account._id,
        toAccountName: toRes.account.name,
      },
    };
  }

  // income / expense
  const accRes = resolveAccount(accounts, parsed.account);
  if (accRes.ambiguous || !accRes.account) return null;

  const categorySuggestion = guessCategory(parsed.description || message);
  const cat = resolveCategory(categories, categorySuggestion);
  const description = cleanDescription(parsed.description) || (parsed.type === 'income' ? 'Pemasukan' : 'Pengeluaran');

  return {
    intent: 'transaction',
    draft: {
      type: parsed.type,
      amount: parsed.amount,
      description,
      categoryId: cat.category?._id ?? null,
      categoryName: cat.name,
      accountId: accRes.account._id,
      accountName: accRes.account.name,
    },
  };
}

/**
 * READ ONLY. Parse a natural-language message into a transaction draft.
 * Never writes to the database — only confirmation via createTransaction does.
 */
async function parseTransaction(userId, message) {
  const [accounts, categories] = await Promise.all([
    Account.find({ user: userId }).sort({ createdAt: 1 }),
    Category.find({ user: userId, type: 'transaction' }).sort({ name: 1 }),
  ]);

  if (!accounts.length) {
    return {
      success: true,
      intent: 'clarify',
      reply: 'Buat rekening dulu di halaman Finance sebelum mencatat transaksi.',
    };
  }

  // Try deterministic parsing first — avoids Gemini call for simple patterns.
  const detResult = tryDeterministicQuickAdd(message, accounts, categories);
  if (detResult) {
    console.log('[AI] quick-add deterministic');
    const draft = detResult.draft;
    if (draft.type === 'transfer') {
      return {
        success: true,
        intent: 'transaction',
        draft,
        reply: `Transfer ${draft.fromAccountName} ke ${draft.toAccountName} sebesar ${fmtIDR(draft.amount)} siap disimpan.`,
      };
    }
    return {
      success: true,
      intent: 'transaction',
      draft,
      reply: `Catat ${draft.type === 'income' ? 'pemasukan' : 'pengeluaran'} "${draft.description}" ${fmtIDR(draft.amount)} pada ${draft.accountName}?`,
    };
  }

  // Fallback to Gemini for complex natural language.
  console.log('[AI] quick-add Gemini fallback');
  const raw = await generate(buildPrompt(message, accounts, categories), {
    systemInstruction: TRANSACTION_PARSER_SYSTEM_PROMPT,
    maxOutputTokens: 512,
  });
  const data = extractJson(raw);
  if (!data) {
    return {
      success: true,
      intent: 'clarify',
      reply: 'Gagal memahami transaksi. Coba gunakan format seperti "jajan 15k bca".',
    };
  }

  const intent = data.intent === 'question' ? 'question' : data.intent === 'clarify' ? 'clarify' : 'transaction';
  if (intent !== 'transaction') {
    return {
      success: true,
      intent,
      reply: cleanDescription(data.reply) || (intent === 'question'
        ? 'Itu pertanyaan, bukan transaksi.'
        : 'Informasi transaksi masih kurang.'),
    };
  }

  const type = data.type;
  if (!['income', 'expense', 'transfer'].includes(type)) {
    return { success: true, intent: 'clarify', reply: 'Tipe transaksi tidak jelas.' };
  }

  const amount = normalizeAmount(data.amount);
  if (amount === null) {
    return { success: true, intent: 'clarify', reply: 'Berapa nominal transaksinya?' };
  }

  // Fallback to the deterministic keyword map when the model returned no
  // category, so messages like "jajan 15k bca" never end up Uncategorized.
  const categorySuggestion =
    typeof data.category === 'string' && data.category.trim()
      ? data.category
      : guessCategory(`${message} ${cleanDescription(data.description) || ''}`);

  if (type === 'transfer') {
    const fromRes = resolveAccount(accounts, data.fromAccount);
    const toRes = resolveAccount(accounts, data.toAccount);

    if (fromRes.ambiguous || toRes.ambiguous) {
      return {
        success: true,
        intent: 'clarify',
        reply: 'Saya menemukan lebih dari satu rekening yang cocok. Silakan pilih rekening yang dimaksud.',
      };
    }
    if (!fromRes.account && !toRes.account) {
      return { success: true, intent: 'clarify', reply: 'Transfer dari dan ke rekening mana?' };
    }
    if (!fromRes.account) {
      return {
        success: true,
        intent: 'clarify',
        reply: toRes.account
          ? `Transfer dari rekening mana ke ${toRes.account.name}?`
          : 'Transfer dari rekening mana?',
      };
    }
    if (!toRes.account) {
      return {
        success: true,
        intent: 'clarify',
        reply: `Transfer dari ${fromRes.account.name} ke rekening mana?`,
      };
    }
    if (String(fromRes.account._id) === String(toRes.account._id)) {
      return { success: true, intent: 'clarify', reply: 'Rekening asal dan tujuan tidak boleh sama.' };
    }

    const cat = resolveCategory(categories, categorySuggestion);
    return {
      success: true,
      intent: 'transaction',
      draft: {
        type: 'transfer',
        amount,
        description: cleanDescription(data.description) || 'Transfer',
        categoryId: cat.category?._id ?? null,
        categoryName: cat.name,
        fromAccountId: fromRes.account._id,
        fromAccountName: fromRes.account.name,
        toAccountId: toRes.account._id,
        toAccountName: toRes.account.name,
      },
      reply: `Transfer ${fromRes.account.name} ke ${toRes.account.name} sebesar ${fmtIDR(amount)} siap disimpan.`,
    };
  }

  // income / expense
  const accRes = resolveAccount(accounts, data.account || data.fromAccount || data.toAccount);
  if (accRes.ambiguous) {
    return {
      success: true,
      intent: 'clarify',
      reply: 'Saya menemukan lebih dari satu rekening yang cocok. Silakan pilih rekening yang dimaksud.',
    };
  }
  if (!accRes.account) {
    return { success: true, intent: 'clarify', reply: 'Mau dipotong dari rekening mana?' };
  }

  const cat = resolveCategory(categories, categorySuggestion);
  const description = cleanDescription(data.description) || (type === 'income' ? 'Pemasukan' : 'Pengeluaran');
  return {
    success: true,
    intent: 'transaction',
    draft: {
      type,
      amount,
      description,
      categoryId: cat.category?._id ?? null,
      categoryName: cat.name,
      accountId: accRes.account._id,
      accountName: accRes.account.name,
    },
    reply: `Catat ${type === 'income' ? 'pemasukan' : 'pengeluaran'} "${description}" ${fmtIDR(amount)} pada ${accRes.account.name}?`,
  };
}

/**
 * THE WRITE PATH. Re-validates the draft end-to-end (it is never trusted
 * from the client) and creates the transaction through the shared service.
 */
async function resolveCategoryForDraft(userId, draft) {
  if (draft.categoryId) {
    const cat = await Category.findOne({ _id: draft.categoryId, user: userId });
    if (!cat) {
      const err = new Error('Category not found');
      err.statusCode = 400;
      throw err;
    }
    return cat._id;
  }
  const suggested = cleanDescription(draft.categoryName);
  if (!suggested) return null;
  const categories = await Category.find({ user: userId, type: 'transaction' });
  const resolved = resolveCategory(categories, suggested);
  if (resolved.category) return resolved.category._id;
  const created = await Category.create({
    user: userId,
    name: suggested.slice(0, MAX_CATEGORY_NAME_LENGTH),
    color: '#FF9F1C',
    icon: 'utensils',
    type: 'transaction',
  });
  return created._id;
}

async function createTransaction(userId, draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    const err = new Error('Draft is required');
    err.statusCode = 400;
    throw err;
  }

  const type = draft.type;
  if (!['income', 'expense', 'transfer'].includes(type)) {
    const err = new Error('Transaction type is invalid');
    err.statusCode = 400;
    throw err;
  }

  const amount = normalizeAmount(draft.amount);
  if (amount === null) {
    const err = new Error('Amount must be greater than zero');
    err.statusCode = 400;
    throw err;
  }

  const description = cleanDescription(draft.description) || '';

  if (type === 'transfer') {
    const fromAccountId = draft.fromAccountId;
    const toAccountId = draft.toAccountId;
    if (!fromAccountId || !toAccountId || String(fromAccountId) === String(toAccountId)) {
      const err = new Error('Select two different accounts for a transfer');
      err.statusCode = 400;
      throw err;
    }
    return transactionService.createTransactionForUser(userId, {
      type: 'transfer',
      amount,
      description,
      fromAccount: fromAccountId,
      toAccount: toAccountId,
    });
  }

  if (!draft.accountId) {
    const err = new Error('Select an account so the balance is updated');
    err.statusCode = 400;
    throw err;
  }

  const category = await resolveCategoryForDraft(userId, draft);
  return transactionService.createTransactionForUser(userId, {
    type,
    amount,
    description,
    category,
    account: draft.accountId,
  });
}

module.exports = {
  parseTransaction,
  createTransaction,
  extractJson,
  normalizeAmount,
  resolveAccount,
  resolveCategory,
  guessCategory,
  deterministicParse,
  tryDeterministicQuickAdd,
  fmtIDR,
};
