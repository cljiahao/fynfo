import {
  employeeCpf,
  estimateAnnualCpf,
  estimateRecordedCpf,
  ordinaryWageCeiling,
} from '@/features/salary/lib/cpf-estimate';
import { toSalaryData } from '@/features/salary/lib/income-aggregates';
import { describe, expect, it } from 'vitest';
import { salaryRow } from '../../helpers/salary-fixture';

describe('full-rate age55-and-below CPF planning model', () => {
  it.each([
    [0, 0],
    [50, 0],
    [500, 0],
    [501, 0],
    [502, 1],
    [750, 150],
    [751, 150],
    [5000.99, 1000],
  ])('computes employee share for wages %s', (wages, expected) => {
    expect(employeeCpf(wages, 0, 8000)).toBe(expected);
  });
  it('uses combined monthly wages and rounds once', () => {
    expect(employeeCpf(400, 200, 8000)).toBe(60);
    expect(employeeCpf(751, 4, 8000)).toBe(151);
  });
  it('applies the published OW ceiling by actual month', () => {
    expect(ordinaryWageCeiling(2023, 8)).toBe(6000);
    expect(ordinaryWageCeiling(2023, 9)).toBe(6300);
    expect(estimateAnnualCpf(84000, 0, 2023)).toBe(14640);
    expect(estimateRecordedCpf([salaryRow('2026-01', 20000, 0)], 2026)).toBe(
      1600
    );
  });
  it('matches CPF Board AW example16, including wage bands after AW exhaustion', () => {
    const bonuses = [
      22000, 10000, 3000, 25800, 15000, 20100, 30000, 2000, 5000, 10000, 15000,
      4100,
    ];
    expect(
      estimateRecordedCpf(
        bonuses.map((bonus, index) => ({
          id: `2024-${String(index + 1).padStart(2, '0')}`,
          salary: 500,
          bonus,
        })),
        2024
      )
    ).toBe(20400);
    expect(employeeCpf(500, 0, 6800, 5000)).toBe(100);
  });
  it('withholds unsupported, duplicate, malformed and nonfinite inputs', () => {
    expect(estimateAnnualCpf(60000, 0, 2030)).toBeNull();
    expect(ordinaryWageCeiling(2026, 13)).toBeNull();
    expect(
      estimateRecordedCpf(
        [salaryRow('2026-01', 0, 0), salaryRow('2026-01', 0, 0)],
        2026
      )
    ).toBeNull();
    expect(estimateRecordedCpf([salaryRow('2026-13', 0, 0)], 2026)).toBeNull();
    expect(employeeCpf(Infinity, 0, 8000)).toBeNull();
    expect(employeeCpf(-1, 0, 8000)).toBeNull();
    expect(employeeCpf(Number.MAX_VALUE, Number.MAX_VALUE, 8000)).toBeNull();
  });
});

it('withholds phased wage bands after AW capping until that contract is established', () => {
  expect(employeeCpf(500, 0, 8000, 200)).toBeNull();
  expect(employeeCpf(500, 100, 8000, 200)).toBeNull();
  expect(employeeCpf(500, 200, 8000, 200)).toBe(120);
});

describe('per-employer CPF for multi-line months', () => {
  const line = (
    id: string,
    type: 'salary' | 'bonus' | 'one_time',
    label: string,
    amount: number
  ) => ({ id, type, label, amount });
  const month = (id: string, lines: ReturnType<typeof line>[]) =>
    toSalaryData(id, lines);

  it('caps OW per employer, not on the combined month', () => {
    const two = month('2025-01', [
      line('a', 'salary', 'Acme', 8000),
      line('b', 'salary', 'Beta', 8000),
    ]);
    // 2025 OW ceiling is 7400: 20% of 7400 per employer.
    expect(estimateRecordedCpf([two], 2025)).toBe(2960);
    const merged = month('2025-01', [line('a', 'salary', 'Acme', 16000)]);
    expect(estimateRecordedCpf([merged], 2025)).toBe(1480);
  });

  it('groups employers by normalized label', () => {
    const both = month('2025-01', [
      line('a', 'salary', ' acme ', 5000),
      line('b', 'salary', 'Beta', 5000),
    ]);
    expect(estimateRecordedCpf([both], 2025)).toBe(2000);
  });

  it('charges bonus as AW against the annual AW ceiling', () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      month(`2025-${String(i + 1).padStart(2, '0')}`, [
        line(`s${i}`, 'salary', 'Acme', 7000),
        line(`t${i}`, 'salary', 'Beta', 7000),
      ])
    );
    const withBonus = [
      ...months.slice(0, 11),
      month('2025-12', [
        ...months[11].lines,
        line('bn', 'bonus', 'AWS', 20000),
      ]),
    ];
    // Total OW is 168000, above the 102000 annual wage ceiling: no AW room.
    expect(estimateRecordedCpf(withBonus, 2025)).toBe(
      estimateRecordedCpf(months, 2025)
    );

    const base = month('2025-02', [line('s', 'salary', 'Acme', 5000)]);
    const plain = estimateRecordedCpf([base], 2025);
    const bonus = month('2025-02', [
      line('s', 'salary', 'Acme', 5000),
      line('bn', 'bonus', 'AWS', 10000),
    ]);
    expect(estimateRecordedCpf([bonus], 2025)).toBe((plain ?? 0) + 2000);
  });

  it('adds no CPF for one-time lines', () => {
    const base = month('2025-03', [line('s', 'salary', 'Acme', 5000)]);
    const extra = month('2025-03', [
      line('s', 'salary', 'Acme', 5000),
      line('o', 'one_time', 'Freelance', 9000),
    ]);
    expect(estimateRecordedCpf([extra], 2025)).toBe(
      estimateRecordedCpf([base], 2025)
    );
    const onlyOneTime = month('2025-03', [line('o', 'one_time', 'Gig', 900)]);
    expect(estimateRecordedCpf([onlyOneTime], 2025)).toBe(0);
  });

  it('leaves legacy rows without lines unchanged', () => {
    const legacy = { id: '2025-01', salary: 8000, bonus: 3000 };
    expect(estimateRecordedCpf([legacy], 2025)).toBe(
      estimateRecordedCpf([salaryRow('2025-01', 8000, 3000)], 2025)
    );
    expect(estimateRecordedCpf([legacy], 2025)).toBe(
      employeeCpf(8000, 3000, 7400, 3000)
    );
  });
});
