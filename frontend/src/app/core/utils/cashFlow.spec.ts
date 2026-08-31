import { describe, expect, it } from 'vitest';
import { buildCashFlowMonths } from './cashFlow';

describe('buildCashFlowMonths', () => {
  it('returns 6 unique, consecutive months in ascending order', () => {
    const months = buildCashFlowMonths(6, {}, new Date(2026, 7, 31)); // Aug 2026
    expect(months).toHaveLength(6);
    expect(months.map((m) => m.key)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
    // labels must be unique (no "May May" / "Jul Jul")
    expect(new Set(months.map((m) => m.label)).size).toBe(6);
  });

  it('defaults income/expense to 0 for months with no transactions', () => {
    const months = buildCashFlowMonths(6, { '2026-07': { income: 4300000, expense: 0 } }, new Date(2026, 7, 31));
    const jul = months.find((m) => m.key === '2026-07')!;
    expect(jul.income).toBe(4300000);
    expect(jul.expense).toBe(0);
    for (const m of months) {
      if (m.key !== '2026-07') expect(m.income).toBe(0);
    }
  });

  it('aggregates the provided per-month data into the matching slot', () => {
    const data = {
      '2026-08': { income: 8700000, expense: 8745000 },
      '2026-07': { income: 4300000, expense: 0 },
    };
    const months = buildCashFlowMonths(6, data, new Date(2026, 7, 31));
    expect(months[5]).toEqual({ key: '2026-08', label: 'Aug', income: 8700000, expense: 8745000 });
    expect(months[4]).toEqual({ key: '2026-07', label: 'Jul', income: 4300000, expense: 0 });
  });
});
