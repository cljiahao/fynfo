import {
  mergeSalaryMonths,
  recurringByEmployer,
  summarizeMonth,
  trailingTwelveMonths,
} from '@/features/salary/lib/income-aggregates';
import { salaryMonthSchema } from '@/features/salary/schemas';
import type { IncomeLine, IncomeLineType } from '@/features/salary/types';
import { describe, expect, it } from 'vitest';

let seq = 0;
function line(type: IncomeLineType, label: string, amount: number): IncomeLine {
  seq += 1;
  return { id: `l${seq}`, type, label, amount };
}

describe('summarizeMonth', () => {
  it('splits recurring, bonus and one-time and totals them', () => {
    expect(
      summarizeMonth([
        line('salary', 'Acme', 5000),
        line('salary', 'Beta', 1000),
        line('bonus', 'Bonus', 2000),
        line('one_time', 'AWS', 300),
      ])
    ).toEqual({ recurring: 6000, bonus: 2000, oneTime: 300, total: 8300 });
  });

  it('returns zeros for no lines', () => {
    expect(summarizeMonth([])).toEqual({
      recurring: 0,
      bonus: 0,
      oneTime: 0,
      total: 0,
    });
  });
});

describe('recurringByEmployer', () => {
  it('groups salary lines by normalized label and ignores other types', () => {
    const byEmployer = recurringByEmployer([
      line('salary', ' Acme ', 5000),
      line('salary', 'beta', 1000),
      line('bonus', 'Acme', 9999),
    ]);
    expect(Object.fromEntries(byEmployer)).toEqual({
      acme: 5000,
      beta: 1000,
    });
  });
});

describe('trailingTwelveMonths', () => {
  const months = [
    { id: '2025-11', lines: [line('bonus', 'B', 100)] },
    { id: '2025-12', lines: [line('bonus', 'B', 200)] },
    { id: '2026-05', lines: [line('one_time', 'Freelance', 50)] },
    {
      id: '2026-11',
      lines: [line('salary', 'Acme', 5000), line('bonus', 'B', 400)],
    },
    { id: '2026-12', lines: [line('bonus', 'B', 800)] },
  ];

  it('covers the 12 calendar months ending at the given month', () => {
    expect(trailingTwelveMonths(months, '2026-11')).toEqual({
      bonus: 600,
      oneTime: 50,
    });
  });

  it('counts a month that has only one-time lines', () => {
    expect(
      trailingTwelveMonths(
        [{ id: '2026-05', lines: [line('one_time', 'X', 70)] }],
        '2026-05'
      )
    ).toEqual({ bonus: 0, oneTime: 70 });
  });

  it('handles two employers without double counting recurring', () => {
    expect(
      trailingTwelveMonths(
        [
          {
            id: '2026-03',
            lines: [line('salary', 'A', 1), line('salary', 'B', 2)],
          },
        ],
        '2026-03'
      )
    ).toEqual({ bonus: 0, oneTime: 0 });
  });
});

describe('mergeSalaryMonths', () => {
  it('lets lines win over the legacy row for a month', () => {
    const [month] = mergeSalaryMonths(
      [{ ...line('salary', 'Acme', 7000), month: '2026-03' }],
      [{ month: '2026-03', salary: 5000, bonus: 1000 }]
    );
    expect(month).toMatchObject({ id: '2026-03', salary: 7000, bonus: 0 });
    expect(month.lines).toHaveLength(1);
  });

  it('synthesizes Salary and Bonus lines from a legacy-only row', () => {
    const [month] = mergeSalaryMonths(
      [],
      [{ month: '2026-03', salary: 5000, bonus: 1000 }]
    );
    expect(month.lines.map((l) => [l.type, l.label, l.amount])).toEqual([
      ['salary', 'Salary', 5000],
      ['bonus', 'Bonus', 1000],
    ]);
    expect(month).toMatchObject({ salary: 5000, bonus: 1000, total: 6000 });
  });

  it('omits the bonus line when bonus is 0 and orders months ascending', () => {
    const months = mergeSalaryMonths(
      [{ ...line('one_time', 'X', 5), month: '2026-01' }],
      [{ month: '2026-02', salary: 100, bonus: 0 }]
    );
    expect(months.map((m) => m.id)).toEqual(['2026-01', '2026-02']);
    expect(months[1].lines).toHaveLength(1);
  });
});

describe('salaryMonthSchema', () => {
  const ok = { id: '2026-03', lines: [line('salary', 'Acme', 100)] };

  it('accepts a valid month and trims labels', () => {
    const parsed = salaryMonthSchema.parse({
      id: '2026-03',
      lines: [line('salary', '  Acme  ', 100)],
    });
    expect(parsed.lines[0].label).toBe('Acme');
  });

  it('rejects duplicate salary labels case-insensitively', () => {
    expect(
      salaryMonthSchema.safeParse({
        id: '2026-03',
        lines: [line('salary', 'Acme', 1), line('salary', ' ACME', 2)],
      }).success
    ).toBe(false);
  });

  it('allows the same label across different types', () => {
    expect(
      salaryMonthSchema.safeParse({
        id: '2026-03',
        lines: [line('salary', 'Acme', 1), line('bonus', 'Acme', 2)],
      }).success
    ).toBe(true);
  });

  it('enforces line count, label length and positive amounts', () => {
    expect(salaryMonthSchema.safeParse({ ...ok, lines: [] }).success).toBe(
      false
    );
    expect(
      salaryMonthSchema.safeParse({
        ...ok,
        lines: Array.from({ length: 21 }, (_, i) =>
          line('one_time', `L${i}`, 1)
        ),
      }).success
    ).toBe(false);
    expect(
      salaryMonthSchema.safeParse({
        ...ok,
        lines: Array.from({ length: 20 }, (_, i) =>
          line('one_time', `L${i}`, 1)
        ),
      }).success
    ).toBe(true);
    expect(
      salaryMonthSchema.safeParse({
        ...ok,
        lines: [line('salary', 'x'.repeat(61), 1)],
      }).success
    ).toBe(false);
    expect(
      salaryMonthSchema.safeParse({
        ...ok,
        lines: [line('salary', 'Acme', 0)],
      }).success
    ).toBe(false);
  });
});
