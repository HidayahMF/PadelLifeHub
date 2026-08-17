// Excel (.xlsx) export service — professional, LifeHub-branded workbooks.
//
// Generates styled sheets with:
//   - bold branded headers (LifeHub yellow), frozen header row, auto filters
//   - auto-fitted column widths, thin professional borders, comfortable row height
//   - Rupiah amount format ("Rp 15.000") and "17 Aug 2026" date format
//   - conditional formatting: income = positive (green), expense = negative (red)
//   - data-bar mini charts for the Dashboard sheet (native Excel in-cell bars)
//
// Every value written here comes from the caller (the export controller),
// which only ever queries the authenticated user's own data. No passwords,
// tokens or secrets are ever written to a workbook.

const ExcelJS = require('exceljs');

// ---------------------------------------------------------------------------
// LifeHub brand palette
// ---------------------------------------------------------------------------
const BRAND = {
  yellow: 'FFFFD600', // --color-primary
  yellowStrong: 'FFE8B400', // --color-primary-strong
  yellowSoft: 'FFFFF3B3', // --color-primary-soft
  ink: 'FF1A1A1A', // --color-ink
  inkSoft: 'FF57534A',
  inkFaint: 'FF9C9687',
  white: 'FFFFFFFF',
  cream: 'FFFFFDF5', // subtle zebra stripe
  border: 'FFE5DFCF',
  incomeFill: 'FFE6F4EA',
  incomeText: 'FF1E7A3C',
  expenseFill: 'FFFCE8E6',
  expenseText: 'FFB3261E',
  neutralFill: 'FFF4F2EA',
};

// ---------------------------------------------------------------------------
// Shared number / date formats
// ---------------------------------------------------------------------------
const RUPIAH = '"Rp "#,##0;[Red]-"Rp "#,##0';
const DATE_FMT = 'dd mmm yyyy';

// ---------------------------------------------------------------------------
// Small styling helpers
// ---------------------------------------------------------------------------

/** Apply the branded header treatment to a row of cells. */
function styleHeaderRow(row, { fromCol = 1, toCol, height = 22 } = {}) {
  row.height = height;
  for (let c = fromCol; c <= toCol; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: BRAND.ink }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.yellow } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND.border } },
      bottom: { style: 'thin', color: { argb: BRAND.border } },
      left: { style: 'thin', color: { argb: BRAND.border } },
      right: { style: 'thin', color: { argb: BRAND.border } },
    };
  }
}

/** Draw thin professional borders across a rectangular cell range. */
function applyBorders(ws, { fromRow, toRow, fromCol = 1, toCol }) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      ws.getCell(r, c).border = {
        top: { style: 'thin', color: { argb: BRAND.border } },
        bottom: { style: 'thin', color: { argb: BRAND.border } },
        left: { style: 'thin', color: { argb: BRAND.border } },
        right: { style: 'thin', color: { argb: BRAND.border } },
      };
    }
  }
}

/** Approximate display length of a cell value (for auto-fit). */
function displayLen(v) {
  if (v === null || v === undefined) return 0;
  if (v instanceof Date) return 14; // "17 Aug 2026"
  if (typeof v === 'number') return Math.max(6, Math.round(Math.abs(v)).toString().length + 7);
  return String(v).length;
}

/** Auto-fit column widths from the values already written. */
function autofit(ws, { fromRow = 1, toRow, fromCol = 1, toCol, min = 9, max = 48 }) {
  for (let c = fromCol; c <= toCol; c++) {
    let longest = 0;
    for (let r = fromRow; r <= toRow; r++) {
      longest = Math.max(longest, displayLen(ws.getCell(r, c).value));
    }
    ws.getColumn(c).width = Math.min(Math.max(longest + 2, min), max);
  }
}

/** Set comfortable, consistent row height for data rows. */
function setRowHeights(ws, { fromRow, toRow, height = 20 }) {
  for (let r = fromRow; r <= toRow; r++) ws.getRow(r).height = height;
}

/** Write a section title row (merged across the columns, branded). */
function sectionTitle(ws, { row, toCol, text, fromCol = 1, height = 20 }) {
  ws.mergeCells(row, fromCol, row, toCol);
  const cell = ws.getCell(row, fromCol);
  cell.value = text;
  cell.font = { bold: true, color: { argb: BRAND.ink }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.yellowSoft } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(row).height = height;
}

/** Write a labelled value row (used by the Dashboard sheet). */
function labelValueRow(ws, { row, fromCol = 1, toCol, label, value, valueFmt, bold = false }) {
  const labelCell = ws.getCell(row, fromCol);
  labelCell.value = label;
  labelCell.font = { color: { argb: BRAND.inkSoft }, size: 11 };
  const valueCell = ws.getCell(row, toCol);
  valueCell.value = value;
  if (valueFmt) valueCell.numFmt = valueFmt;
  valueCell.font = { bold, color: { argb: BRAND.ink }, size: 11 };
  valueCell.alignment = { vertical: 'middle', horizontal: 'right' };
  ws.getRow(row).height = 20;
}

/** Normalize a raw date (Date | ISO string | null) to a Date or null. */
function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "BCA" + "GoPay" -> "BCA → GoPay" (transfer display). */
function transferLabel(from, to) {
  if (!from && !to) return '';
  return [from, to].filter(Boolean).join(' → ');
}

/** Compute data-bar conditional formatting config for a numeric column. */
function dataBarRule({ min = 0, max = 100, priority = 1, color = BRAND.yellowStrong, x14Id }) {
  return {
    type: 'dataBar',
    priority,
    cfvo: [
      { type: 'num', value: min },
      { type: 'num', value: max },
    ],
    color: { argb: color },
    x14Id,
  };
}

// ---------------------------------------------------------------------------
// Transactions sheet
// ---------------------------------------------------------------------------

/**
 * Build the "Transactions" sheet. When `summary` is true a small
 * Total Income / Total Expense / Net Cash Flow block is placed above the table
 * (used by the standalone transactions export).
 */
function buildTransactionsSheet(wb, { transactions, summary = false }) {
  const ws = wb.addWorksheet('Transactions');
  const headers = ['Date', 'Type', 'Description', 'Category', 'Account', 'Amount'];
  const toCol = headers.length;

  let headerRow = 1;
  let firstDataRow = 2;

  if (summary) {
    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalExpense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const net = totalIncome - totalExpense;

    const rows = [
      ['Total Income', totalIncome, BRAND.incomeText],
      ['Total Expense', totalExpense, BRAND.expenseText],
      ['Net Cash Flow', net, net >= 0 ? BRAND.incomeText : BRAND.expenseText],
    ];
    rows.forEach(([label, value, color], i) => {
      const r = i + 1;
      const labelCell = ws.getCell(r, 1);
      labelCell.value = label;
      labelCell.font = { bold: true, color: { argb: BRAND.ink }, size: 11 };
      const valueCell = ws.getCell(r, toCol);
      valueCell.value = value;
      valueCell.numFmt = RUPIAH;
      valueCell.font = { bold: true, color: { argb: color }, size: 11 };
      valueCell.alignment = { vertical: 'middle', horizontal: 'right' };
      ws.getRow(r).height = 20;
    });
    headerRow = 5;
    firstDataRow = 6;
  }

  // Header row
  headers.forEach((h, i) => {
    ws.getCell(headerRow, i + 1).value = h;
  });
  styleHeaderRow(ws.getRow(headerRow), { toCol });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  // Data rows
  transactions.forEach((t, i) => {
    const r = firstDataRow + i;
    const isTransfer = t.type === 'transfer';
    const account =
      isTransfer ? transferLabel(t.fromAccount?.name, t.toAccount?.name) : t.account?.name ?? '';

    ws.getCell(r, 1).value = toDate(t.date);
    ws.getCell(r, 1).numFmt = DATE_FMT;
    ws.getCell(r, 2).value = t.type;
    ws.getCell(r, 3).value = t.description || '';
    ws.getCell(r, 4).value = isTransfer ? '' : t.category?.name ?? '';
    ws.getCell(r, 5).value = account;
    ws.getCell(r, 6).value = Number(t.amount || 0);
    ws.getCell(r, 6).numFmt = RUPIAH;
    ws.getCell(r, 6).alignment = { vertical: 'middle', horizontal: 'right' };
  });

  const lastRow = Math.max(headerRow, firstDataRow + transactions.length - 1);

  if (transactions.length) {
    applyBorders(ws, { fromRow: firstDataRow, toRow: lastRow, toCol });
    setRowHeights(ws, { fromRow: firstDataRow, toRow: lastRow });
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: toCol } };

    // Conditional formatting: income = positive green, expense = negative red.
    ws.addConditionalFormatting({
      ref: `B${firstDataRow}:B${lastRow}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"income"'],
          priority: 1,
          style: {
            font: { color: { argb: BRAND.incomeText }, bold: true },
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: BRAND.incomeFill } },
          },
        },
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"expense"'],
          priority: 2,
          style: {
            font: { color: { argb: BRAND.expenseText }, bold: true },
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: BRAND.expenseFill } },
          },
        },
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"transfer"'],
          priority: 3,
          style: {
            font: { color: { argb: BRAND.inkSoft } },
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: BRAND.neutralFill } },
          },
        },
      ],
    });
    // Amount column follows the row's type (income green / expense red).
    ws.addConditionalFormatting({
      ref: `F${firstDataRow}:F${lastRow}`,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: [`$B${firstDataRow}="income"`],
          style: { font: { color: { argb: BRAND.incomeText }, bold: true } },
        },
        {
          type: 'expression',
          priority: 2,
          formulae: [`$B${firstDataRow}="expense"`],
          style: { font: { color: { argb: BRAND.expenseText }, bold: true } },
        },
      ],
    });
  }

  autofit(ws, { fromRow: 1, toRow: lastRow, toCol });
  return ws;
}

// ---------------------------------------------------------------------------
// Tasks sheet
// ---------------------------------------------------------------------------

/** Build the "Tasks" sheet with status/priority-aware formatting. */
function buildTasksSheet(wb, tasks) {
  const ws = wb.addWorksheet('Tasks');
  const headers = ['Title', 'Description', 'Category', 'Priority', 'Status', 'Due Date', 'Completed Date'];
  const toCol = headers.length;
  const headerRow = 1;
  const firstDataRow = 2;

  headers.forEach((h, i) => {
    ws.getCell(headerRow, i + 1).value = h;
  });
  styleHeaderRow(ws.getRow(headerRow), { toCol });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  tasks.forEach((t, i) => {
    const r = firstDataRow + i;
    const completed = t.status === 'completed';
    ws.getCell(r, 1).value = t.title || '';
    ws.getCell(r, 2).value = t.description || '';
    ws.getCell(r, 3).value = t.category?.name ?? '';
    ws.getCell(r, 4).value = t.priority || 'medium';
    ws.getCell(r, 5).value = t.status || 'pending';
    ws.getCell(r, 6).value = toDate(t.dueDate);
    ws.getCell(r, 6).numFmt = DATE_FMT;
    ws.getCell(r, 7).value = toDate(t.completedAt);
    ws.getCell(r, 7).numFmt = DATE_FMT;

    // Completed tasks read as "done": muted text, strike-through title.
    if (completed) {
      for (let c = 1; c <= toCol; c++) {
        const cell = ws.getCell(r, c);
        cell.font = { color: { argb: BRAND.inkFaint }, strike: true, size: 11 };
      }
    }
  });

  const lastRow = Math.max(headerRow, firstDataRow + tasks.length - 1);

  if (tasks.length) {
    applyBorders(ws, { fromRow: firstDataRow, toRow: lastRow, toCol });
    setRowHeights(ws, { fromRow: firstDataRow, toRow: lastRow });
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: toCol } };

    // Status column: completed = green, pending = neutral amber.
    ws.addConditionalFormatting({
      ref: `E${firstDataRow}:E${lastRow}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"completed"'],
          priority: 1,
          style: {
            font: { color: { argb: BRAND.incomeText }, bold: true },
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: BRAND.incomeFill } },
          },
        },
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"pending"'],
          priority: 2,
          style: {
            font: { color: { argb: BRAND.ink } },
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: BRAND.neutralFill } },
          },
        },
      ],
    });
    // Priority column: high = warning, low = calm, medium = subtle.
    ws.addConditionalFormatting({
      ref: `D${firstDataRow}:D${lastRow}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"high"'],
          priority: 1,
          style: {
            font: { color: { argb: BRAND.expenseText }, bold: true },
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: BRAND.expenseFill } },
          },
        },
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"medium"'],
          priority: 2,
          style: { font: { color: { argb: BRAND.inkSoft } } },
        },
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"low"'],
          priority: 3,
          style: { font: { color: { argb: BRAND.incomeText } } },
        },
      ],
    });
  }

  autofit(ws, { fromRow: 1, toRow: lastRow, toCol });
  return ws;
}

// ---------------------------------------------------------------------------
// Full LifeHub workbook
// ---------------------------------------------------------------------------

/** Dashboard sheet — the professional overview page of the full export. */
function buildDashboardSheet(wb, data) {
  const ws = wb.addWorksheet('Dashboard');
  const toCol = 4;
  let row = 1;

  // Title
  ws.mergeCells(row, 1, row, toCol);
  const title = ws.getCell(row, 1);
  title.value = 'LifeHub Dashboard';
  title.font = { bold: true, color: { argb: BRAND.ink }, size: 14 };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.yellow } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(row).height = 28;
  row += 2;

  // Financial Summary
  sectionTitle(ws, { row, toCol, text: 'Financial Summary' });
  row += 1;
  const financial = [
    ['Total Balance / Net Worth', data.netWorth],
    ['Liquid Assets (cash + bank + e-wallet)', data.liquidAssets],
    ['Investment Assets', data.investmentAssets],
    ['Total Income', data.totalIncome],
    ['Total Expense', data.totalExpense],
    ['Net Cash Flow', data.netCashFlow],
  ];
  for (const [label, value] of financial) {
    labelValueRow(ws, { row, toCol, label, value, valueFmt: RUPIAH, bold: label.startsWith('Total Balance') });
    row += 1;
  }

  row += 1;
  sectionTitle(ws, { row, toCol, text: 'Productivity Summary' });
  row += 1;
  const productivity = [
    ['Number of Accounts', data.accountCount],
    ['Number of Transactions', data.transactionCount],
    ['Task Completion', `${data.completedTasks} of ${data.totalTasks} (${data.taskCompletionPct}%)`],
    ['Active Goals', data.activeGoals],
    ['Habit Streak (best)', `${data.bestHabitStreak} day${data.bestHabitStreak === 1 ? '' : 's'}`],
  ];
  for (const [label, value] of productivity) {
    labelValueRow(ws, { row, toCol, label, value });
    row += 1;
  }

  row += 1;
  sectionTitle(ws, { row, toCol, text: 'Account Overview' });
  row += 1;
  const accHeader = row;
  ['Account', 'Type', '', 'Balance'].forEach((h, i) => {
    ws.getCell(row, i + 1).value = h;
  });
  styleHeaderRow(ws.getRow(row), { toCol });
  row += 1;
  const accFirstData = row;
  (data.accounts || []).forEach((a) => {
    ws.getCell(row, 1).value = a.name;
    ws.getCell(row, 2).value = a.type;
    ws.getCell(row, 4).value = Number(a.balance || 0);
    ws.getCell(row, 4).numFmt = RUPIAH;
    ws.getCell(row, 4).alignment = { vertical: 'middle', horizontal: 'right' };
    ws.getRow(row).height = 20;
    row += 1;
  });
  const accLastData = Math.max(accFirstData, row - 1);
  if (data.accounts?.length) {
    applyBorders(ws, { fromRow: accFirstData, toRow: accLastData, toCol });
    const maxBalance = Math.max(1, ...data.accounts.map((a) => Number(a.balance || 0)));
    ws.addConditionalFormatting({
      ref: `D${accFirstData}:D${accLastData}`,
      rules: [dataBarRule({ min: 0, max: maxBalance, priority: 1, x14Id: '1' })],
    });
  }

  // Income vs Expense mini chart (data bars)
  row += 1;
  sectionTitle(ws, { row, toCol, text: 'Income vs Expense' });
  row += 1;
  const ieHeader = row;
  ['Metric', '', '', 'Amount'].forEach((h, i) => ws.getCell(row, i + 1).value = h);
  styleHeaderRow(ws.getRow(row), { toCol });
  row += 1;
  const ieFirstData = row;
  labelValueRow(ws, { row, toCol, label: 'Income', value: data.totalIncome, valueFmt: RUPIAH, bold: true });
  ws.getCell(row, 1).font = { color: { argb: BRAND.incomeText }, bold: true, size: 11 };
  row += 1;
  labelValueRow(ws, { row, toCol, label: 'Expense', value: data.totalExpense, valueFmt: RUPIAH, bold: true });
  ws.getCell(row, 1).font = { color: { argb: BRAND.expenseText }, bold: true, size: 11 };
  const ieLastData = row;
  applyBorders(ws, { fromRow: ieFirstData, toRow: ieLastData, toCol });
  const maxFlow = Math.max(1, data.totalIncome, data.totalExpense);
  ws.addConditionalFormatting({
    ref: `D${ieFirstData}:D${ieLastData}`,
    rules: [dataBarRule({ min: 0, max: maxFlow, priority: 1, x14Id: '2' })],
  });

  // Spending by Category mini chart (data bars)
  if (data.categorySpending?.length) {
    row += 1;
    sectionTitle(ws, { row, toCol, text: 'Spending by Category' });
    row += 1;
    const catHeader = row;
    ['Category', '', '', 'Total'].forEach((h, i) => ws.getCell(row, i + 1).value = h);
    styleHeaderRow(ws.getRow(row), { toCol });
    row += 1;
    const catFirstData = row;
    for (const c of data.categorySpending) {
      ws.getCell(row, 1).value = c.name;
      ws.getCell(row, 4).value = Number(c.total || 0);
      ws.getCell(row, 4).numFmt = RUPIAH;
      ws.getCell(row, 4).alignment = { vertical: 'middle', horizontal: 'right' };
      ws.getRow(row).height = 20;
      row += 1;
    }
    const catLastData = row - 1;
    applyBorders(ws, { fromRow: catFirstData, toRow: catLastData, toCol });
    const maxCat = Math.max(1, ...data.categorySpending.map((c) => Number(c.total || 0)));
    ws.addConditionalFormatting({
      ref: `D${catFirstData}:D${catLastData}`,
      rules: [dataBarRule({ min: 0, max: maxCat, priority: 1, x14Id: '3' })],
    });
  }

  autofit(ws, { fromRow: 1, toRow: row - 1, toCol });
  return ws;
}

/** Accounts sheet with type + balance and totals. */
function buildAccountsSheet(wb, { accounts }) {
  const ws = wb.addWorksheet('Accounts');
  const headers = ['Account Name', 'Account Type', 'Balance'];
  const toCol = headers.length;
  const headerRow = 1;
  const firstDataRow = 2;

  headers.forEach((h, i) => ws.getCell(headerRow, i + 1).value = h);
  styleHeaderRow(ws.getRow(headerRow), { toCol });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  (accounts || []).forEach((a, i) => {
    const r = firstDataRow + i;
    ws.getCell(r, 1).value = a.name;
    ws.getCell(r, 2).value = a.type;
    ws.getCell(r, 3).value = Number(a.balance || 0);
    ws.getCell(r, 3).numFmt = RUPIAH;
    ws.getCell(r, 3).alignment = { vertical: 'middle', horizontal: 'right' };
  });

  const lastRow = Math.max(headerRow, firstDataRow + accounts.length - 1);

  if (accounts.length) {
    applyBorders(ws, { fromRow: firstDataRow, toRow: lastRow, toCol });
    setRowHeights(ws, { fromRow: firstDataRow, toRow: lastRow });
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: toCol } };
  }

  // Totals block
  const totals = {
    'Total Balance': accounts.reduce((s, a) => s + Number(a.balance || 0), 0),
    'Liquid Assets (cash + bank + e-wallet)': accounts
      .filter((a) => a.type !== 'investment')
      .reduce((s, a) => s + Number(a.balance || 0), 0),
    'Investment Assets': accounts
      .filter((a) => a.type === 'investment')
      .reduce((s, a) => s + Number(a.balance || 0), 0),
    'Net Worth': accounts.reduce((s, a) => s + Number(a.balance || 0), 0),
  };
  let row = lastRow + 2;
  for (const [label, value] of Object.entries(totals)) {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = { bold: true, color: { argb: BRAND.ink }, size: 11 };
    ws.getCell(row, 3).value = value;
    ws.getCell(row, 3).numFmt = RUPIAH;
    ws.getCell(row, 3).font = { bold: true, color: { argb: BRAND.ink }, size: 11 };
    ws.getCell(row, 3).alignment = { vertical: 'middle', horizontal: 'right' };
    ws.getRow(row).height = 20;
    row += 1;
  }

  autofit(ws, { fromRow: 1, toRow: row - 1, toCol });
  return ws;
}

/** Goals sheet. */
function buildGoalsSheet(wb, goals) {
  const ws = wb.addWorksheet('Goals');
  const headers = ['Title', 'Kind', 'Target', 'Progress', 'Unit', 'Deadline', 'Completed'];
  const toCol = headers.length;
  const headerRow = 1;
  const firstDataRow = 2;

  headers.forEach((h, i) => ws.getCell(headerRow, i + 1).value = h);
  styleHeaderRow(ws.getRow(headerRow), { toCol });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  (goals || []).forEach((g, i) => {
    const r = firstDataRow + i;
    const isSavings = g.kind === 'savings';
    ws.getCell(r, 1).value = g.title || '';
    ws.getCell(r, 2).value = g.kind || 'general';
    ws.getCell(r, 3).value = g.target ?? null;
    if (isSavings) ws.getCell(r, 3).numFmt = RUPIAH;
    ws.getCell(r, 4).value = g.progress ?? 0;
    if (isSavings) ws.getCell(r, 4).numFmt = RUPIAH;
    ws.getCell(r, 5).value = g.unit || '';
    ws.getCell(r, 6).value = toDate(g.deadline);
    ws.getCell(r, 6).numFmt = DATE_FMT;
    ws.getCell(r, 7).value = g.completed ? 'yes' : 'no';
    if (g.completed) {
      ws.getCell(r, 7).font = { color: { argb: BRAND.incomeText }, bold: true, size: 11 };
    }
  });

  const lastRow = Math.max(headerRow, firstDataRow + goals.length - 1);
  if (goals.length) {
    applyBorders(ws, { fromRow: firstDataRow, toRow: lastRow, toCol });
    setRowHeights(ws, { fromRow: firstDataRow, toRow: lastRow });
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: toCol } };
  }
  autofit(ws, { fromRow: 1, toRow: lastRow, toCol });
  return ws;
}

/** Habits sheet. */
function buildHabitsSheet(wb, habits) {
  const ws = wb.addWorksheet('Habits');
  const headers = ['Name', 'Frequency', 'Streak', 'Best Streak', 'Completions', 'Archived'];
  const toCol = headers.length;
  const headerRow = 1;
  const firstDataRow = 2;

  headers.forEach((h, i) => ws.getCell(headerRow, i + 1).value = h);
  styleHeaderRow(ws.getRow(headerRow), { toCol });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  (habits || []).forEach((h, i) => {
    const r = firstDataRow + i;
    ws.getCell(r, 1).value = h.name || '';
    ws.getCell(r, 2).value = h.frequency || 'daily';
    ws.getCell(r, 3).value = h.streak ?? 0;
    ws.getCell(r, 4).value = h.bestStreak ?? 0;
    ws.getCell(r, 5).value = (h.completedDates || []).length;
    ws.getCell(r, 6).value = h.archived ? 'yes' : 'no';
  });

  const lastRow = Math.max(headerRow, firstDataRow + habits.length - 1);
  if (habits.length) {
    applyBorders(ws, { fromRow: firstDataRow, toRow: lastRow, toCol });
    setRowHeights(ws, { fromRow: firstDataRow, toRow: lastRow });
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: toCol } };
  }
  autofit(ws, { fromRow: 1, toRow: lastRow, toCol });
  return ws;
}

/** Wishlist sheet. */
function buildWishlistSheet(wb, items) {
  const ws = wb.addWorksheet('Wishlist');
  const headers = ['Item', 'Price', 'Priority', 'Status', 'Target Date', 'URL'];
  const toCol = headers.length;
  const headerRow = 1;
  const firstDataRow = 2;

  headers.forEach((h, i) => ws.getCell(headerRow, i + 1).value = h);
  styleHeaderRow(ws.getRow(headerRow), { toCol });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  (items || []).forEach((it, i) => {
    const r = firstDataRow + i;
    ws.getCell(r, 1).value = it.name || '';
    ws.getCell(r, 2).value = Number(it.price || 0);
    ws.getCell(r, 2).numFmt = RUPIAH;
    ws.getCell(r, 3).value = it.priority || 'medium';
    ws.getCell(r, 4).value = it.status || 'saved';
    ws.getCell(r, 5).value = toDate(it.targetDate);
    ws.getCell(r, 5).numFmt = DATE_FMT;
    ws.getCell(r, 6).value = it.url || '';
  });

  const lastRow = Math.max(headerRow, firstDataRow + items.length - 1);
  if (items.length) {
    applyBorders(ws, { fromRow: firstDataRow, toRow: lastRow, toCol });
    setRowHeights(ws, { fromRow: firstDataRow, toRow: lastRow });
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: toCol } };
  }
  autofit(ws, { fromRow: 1, toRow: lastRow, toCol });
  return ws;
}

/** Needs sheet. */
function buildNeedsSheet(wb, items) {
  const ws = wb.addWorksheet('Needs');
  const headers = ['Item', 'Quantity', 'Unit', 'Estimated Price', 'Category', 'Urgent', 'Purchased'];
  const toCol = headers.length;
  const headerRow = 1;
  const firstDataRow = 2;

  headers.forEach((h, i) => ws.getCell(headerRow, i + 1).value = h);
  styleHeaderRow(ws.getRow(headerRow), { toCol });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  (items || []).forEach((it, i) => {
    const r = firstDataRow + i;
    ws.getCell(r, 1).value = it.name || '';
    ws.getCell(r, 2).value = it.quantity ?? 1;
    ws.getCell(r, 3).value = it.unit || 'item';
    ws.getCell(r, 4).value = Number(it.estimatedPrice || 0);
    ws.getCell(r, 4).numFmt = RUPIAH;
    ws.getCell(r, 5).value = it.category || 'general';
    ws.getCell(r, 6).value = it.urgent ? 'yes' : 'no';
    ws.getCell(r, 7).value = it.purchased ? 'yes' : 'no';
  });

  const lastRow = Math.max(headerRow, firstDataRow + items.length - 1);
  if (items.length) {
    applyBorders(ws, { fromRow: firstDataRow, toRow: lastRow, toCol });
    setRowHeights(ws, { fromRow: firstDataRow, toRow: lastRow });
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: toCol } };
  }
  autofit(ws, { fromRow: 1, toRow: lastRow, toCol });
  return ws;
}

/** Notes sheet. */
function buildNotesSheet(wb, notes) {
  const ws = wb.addWorksheet('Notes');
  const headers = ['Title', 'Pinned', 'Tags', 'Updated At', 'Content'];
  const toCol = headers.length;
  const headerRow = 1;
  const firstDataRow = 2;

  headers.forEach((h, i) => ws.getCell(headerRow, i + 1).value = h);
  styleHeaderRow(ws.getRow(headerRow), { toCol });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  (notes || []).forEach((n, i) => {
    const r = firstDataRow + i;
    ws.getCell(r, 1).value = n.title || '';
    ws.getCell(r, 2).value = n.pinned ? 'yes' : 'no';
    ws.getCell(r, 3).value = (n.tags || []).join(', ');
    ws.getCell(r, 4).value = toDate(n.updatedAt || n.createdAt);
    ws.getCell(r, 4).numFmt = DATE_FMT;
    ws.getCell(r, 5).value = n.content || '';
    ws.getCell(r, 5).alignment = { vertical: 'top', wrapText: true };
    ws.getRow(r).height = 24;
  });

  const lastRow = Math.max(headerRow, firstDataRow + notes.length - 1);
  if (notes.length) {
    applyBorders(ws, { fromRow: firstDataRow, toRow: lastRow, toCol });
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: toCol } };
  }
  autofit(ws, { fromRow: 1, toRow: lastRow, toCol });
  return ws;
}

/** Calendar sheet — built from tasks with due dates + reminders (same sources as the app calendar). */
function buildCalendarSheet(wb, { tasks, reminders }) {
  const ws = wb.addWorksheet('Calendar');
  const headers = ['Date', 'Title', 'Type', 'Status'];
  const toCol = headers.length;
  const headerRow = 1;
  const firstDataRow = 2;

  const rows = [];
  (tasks || [])
    .filter((t) => t.dueDate)
    .forEach((t) => {
      rows.push({
        date: toDate(t.dueDate),
        title: t.title || '',
        type: 'Task',
        status: t.status || 'pending',
      });
    });
  (reminders || [])
    .filter((r) => r.datetime)
    .forEach((r) => {
      rows.push({
        date: toDate(r.datetime),
        title: r.title || '',
        type: 'Reminder',
        status: r.done ? 'done' : 'active',
      });
    });
  rows.sort((a, b) => (a.date || 0) - (b.date || 0));

  headers.forEach((h, i) => ws.getCell(headerRow, i + 1).value = h);
  styleHeaderRow(ws.getRow(headerRow), { toCol });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];

  rows.forEach((r, i) => {
    const row = firstDataRow + i;
    ws.getCell(row, 1).value = r.date;
    ws.getCell(row, 1).numFmt = DATE_FMT;
    ws.getCell(row, 2).value = r.title;
    ws.getCell(row, 3).value = r.type;
    ws.getCell(row, 4).value = r.status;
  });

  const lastRow = Math.max(headerRow, firstDataRow + rows.length - 1);
  if (rows.length) {
    applyBorders(ws, { fromRow: firstDataRow, toRow: lastRow, toCol });
    setRowHeights(ws, { fromRow: firstDataRow, toRow: lastRow });
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: toCol } };
  }
  autofit(ws, { fromRow: 1, toRow: lastRow, toCol });
  return ws;
}

/** Monthly Review sheet — rendered from the monthly-review computation. */
function buildMonthlyReviewSheet(wb, review) {
  const ws = wb.addWorksheet('Monthly Review');
  const toCol = 4;
  let row = 1;

  ws.mergeCells(row, 1, row, toCol);
  const title = ws.getCell(row, 1);
  title.value = `Monthly Review — ${review.monthLabel || review.month || ''}`;
  title.font = { bold: true, color: { argb: BRAND.ink }, size: 14 };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.yellow } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(row).height = 28;
  row += 2;

  sectionTitle(ws, { row, toCol, text: 'Finance' });
  row += 1;
  const finance = review.finance || {};
  const netWorth = review.netWorth || {};
  const finRows = [
    ['Income', finance.income ?? 0],
    ['Expense', finance.expense ?? 0],
    ['Net Cash Flow', finance.saved ?? 0],
    ['Total Balance / Net Worth', netWorth.total ?? 0],
    ['Liquid Assets', netWorth.liquid ?? 0],
    ['Investment Assets', netWorth.investment ?? 0],
  ];
  for (const [label, value] of finRows) {
    labelValueRow(ws, { row, toCol, label, value, valueFmt: RUPIAH });
    row += 1;
  }

  if ((review.topCategories || []).length) {
    row += 1;
    sectionTitle(ws, { row, toCol, text: 'Top Spending Categories' });
    row += 1;
    for (const c of review.topCategories) {
      ws.getCell(row, 1).value = c.name;
      ws.getCell(row, 4).value = Number(c.total || 0);
      ws.getCell(row, 4).numFmt = RUPIAH;
      ws.getCell(row, 4).alignment = { vertical: 'middle', horizontal: 'right' };
      ws.getRow(row).height = 20;
      row += 1;
    }
  }

  if ((review.budgetPerformance || []).length) {
    row += 1;
    sectionTitle(ws, { row, toCol, text: 'Budget Performance' });
    row += 1;
    for (const b of review.budgetPerformance) {
      ws.getCell(row, 1).value = b.name;
      ws.getCell(row, 2).value = `Spent ${Math.round(b.pct || 0)}% of budget`;
      ws.getCell(row, 4).value = Number(b.spent || 0);
      ws.getCell(row, 4).numFmt = RUPIAH;
      ws.getCell(row, 4).alignment = { vertical: 'middle', horizontal: 'right' };
      ws.getCell(row, 1).font = {
        bold: b.over,
        color: { argb: b.over ? BRAND.expenseText : BRAND.ink },
        size: 11,
      };
      ws.getRow(row).height = 20;
      row += 1;
    }
  }

  row += 1;
  sectionTitle(ws, { row, toCol, text: 'Productivity & Habits' });
  row += 1;
  const productivity = review.productivity || {};
  const habits = review.habits || {};
  const goals = review.goals || {};
  const focus = review.focus || {};
  const prodRows = [
    ['Tasks Completed', productivity.completed ?? 0],
    ['Task Completion Rate', `${productivity.completionRate ?? 0}%`],
    ['Overdue Tasks', productivity.overdue ?? 0],
    ['Focus Time (minutes)', Math.round((focus.duration || 0) / 60)],
    ['Habits Tracked', habits.tracked ?? 0],
    ['Habit Average Completion', `${habits.averageCompletion ?? 0}%`],
    ['Best Habit Streak (days)', habits.bestStreak ?? 0],
    ['Goals Progressed', goals.progressed ?? 0],
    ['Goals Completed', goals.completed ?? 0],
  ];
  for (const [label, value] of prodRows) {
    labelValueRow(ws, { row, toCol, label, value });
    row += 1;
  }

  autofit(ws, { fromRow: 1, toRow: row - 1, toCol });
  return ws;
}

// ---------------------------------------------------------------------------
// Top-level builders
// ---------------------------------------------------------------------------

/** Transactions workbook (standalone) with summary block + full styling. */
async function buildTransactionsWorkbook({ transactions }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LifeHub';
  wb.created = new Date();
  buildTransactionsSheet(wb, { transactions, summary: true });
  return wb;
}

/** Tasks workbook (standalone). */
async function buildTasksWorkbook({ tasks }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LifeHub';
  wb.created = new Date();
  buildTasksSheet(wb, tasks);
  return wb;
}

/**
 * Full LifeHub workbook — Dashboard, Accounts, Transactions, Tasks, Goals,
 * Habits, Wishlist, Needs, Notes, Calendar, Monthly Review.
 */
async function buildFullWorkbook(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LifeHub';
  wb.created = new Date();

  buildDashboardSheet(wb, data.dashboard);
  buildAccountsSheet(wb, { accounts: data.accounts });
  buildTransactionsSheet(wb, { transactions: data.transactions, summary: false });
  buildTasksSheet(wb, data.tasks);
  buildGoalsSheet(wb, data.goals);
  buildHabitsSheet(wb, data.habits);
  buildWishlistSheet(wb, data.wishlist);
  buildNeedsSheet(wb, data.needs);
  buildNotesSheet(wb, data.notes);
  buildCalendarSheet(wb, { tasks: data.tasks, reminders: data.reminders });
  if (data.monthlyReview) {
    buildMonthlyReviewSheet(wb, data.monthlyReview);
  }
  return wb;
}

module.exports = {
  buildTransactionsWorkbook,
  buildTasksWorkbook,
  buildFullWorkbook,
  RUPIAH,
  DATE_FMT,
};
