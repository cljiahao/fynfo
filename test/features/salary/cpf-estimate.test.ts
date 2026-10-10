import {
  employeeCpf,
  estimateAnnualCpf,
  estimateRecordedCpf,
  ordinaryWageCeiling,
} from '@/features/salary/lib/cpf-estimate';
import { describe, expect, it } from 'vitest';

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
    expect(
      estimateRecordedCpf([{ id: '2026-01', salary: 20000, bonus: 0 }], 2026)
    ).toBe(1600);
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
        [
          { id: '2026-01', salary: 0, bonus: 0 },
          { id: '2026-01', salary: 0, bonus: 0 },
        ],
        2026
      )
    ).toBeNull();
    expect(
      estimateRecordedCpf([{ id: '2026-13', salary: 0, bonus: 0 }], 2026)
    ).toBeNull();
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
