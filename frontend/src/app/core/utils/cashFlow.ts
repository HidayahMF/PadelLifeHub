import { getLocale } from './locale';

export interface CashFlowMonth {
  /** Sortable raw key, e.g. "2026-03". */
  key: string;
  /** Short display label, e.g. "Mar". */
  label: string;
  income: number;
  expense: number;
}

/** Aggregated income/expense keyed by "YYYY-MM". */
export type CashFlowByMonth = Record<string, { income: number; expense: number }>;

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/**
 * Build the last `count` consecutive calendar months (oldest → newest), each
 * with its aggregated income/expense pulled from `data` (defaults to 0 when a
 * month has no transactions). The month list is generated from dates — never
 * from the data map — so it is ALWAYS `count` unique, consecutive, ordered
 * entries even when entire months are empty.
 */
export function buildCashFlowMonths(
  count: number,
  data: CashFlowByMonth,
  today: Date = new Date()
): CashFlowMonth[] {
  const list: CashFlowMonth[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = keyOf(d);
    const month = data[key] ?? { income: 0, expense: 0 };
    list.push({
      key,
      label: new Intl.DateTimeFormat(getLocale(), { month: 'short' }).format(d),
      income: Number(month.income) || 0,
      expense: Number(month.expense) || 0,
    });
  }
  return list;
}
