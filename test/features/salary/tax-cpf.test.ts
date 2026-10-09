import { describe, expect, it } from 'vitest';

import {
  calculateAnnualCpf,
  calculateMonthlyCpf,
  calculateTax,
  computeAutoReliefs,
  getCpfAnnualCeiling,
  getCpfMonthlyCeiling,
  getEarnedIncomeRelief,
  calculateTaxSummary as readTaxSummary,
} from '@/features/salary/lib/tax-cpf';

function calculateTaxSummary(...args: Parameters<typeof readTaxSummary>) {
  const result = readTaxSummary(...args);
  if (result === null) throw new Error('Expected a supported CPF fixture');
  return result;
}
describe('getEarnedIncomeRelief', () => {
  it('returns 1000 for null age', () => {
    expect(getEarnedIncomeRelief(null)).toBe(1000);
  });

  it('returns 1000 for age under 55', () => {
    expect(getEarnedIncomeRelief(30)).toBe(1000);
    expect(getEarnedIncomeRelief(54)).toBe(1000);
  });

  it('returns 6000 for age 55–59', () => {
    expect(getEarnedIncomeRelief(55)).toBe(6000);
    expect(getEarnedIncomeRelief(59)).toBe(6000);
  });

  it('returns 8000 for age 60 and above', () => {
    expect(getEarnedIncomeRelief(60)).toBe(8000);
    expect(getEarnedIncomeRelief(70)).toBe(8000);
  });
});

describe('computeAutoReliefs', () => {
  it('returns zero reliefs for non-resident regardless of age or nsman status', () => {
    expect(
      computeAutoReliefs(
        { birthYear: 1990, isNsman: true, residencyStatus: 'non_resident' },
        2026
      )
    ).toEqual({ earnedIncomeRelief: 0, nsmanRelief: 0 });
  });

  it('returns 1000 earned income relief for resident with null birthYear', () => {
    const result = computeAutoReliefs(
      { birthYear: null, isNsman: false, residencyStatus: 'resident' },
      2026
    );
    expect(result.earnedIncomeRelief).toBe(1000);
  });

  it('computes age-based earned income relief using birth year', () => {
    // age 61 in 2026
    const result = computeAutoReliefs(
      { birthYear: 1965, isNsman: false, residencyStatus: 'resident' },
      2026
    );
    expect(result.earnedIncomeRelief).toBe(8000);
  });

  it('returns 1500 nsman relief when isNsman is true', () => {
    const result = computeAutoReliefs(
      { birthYear: 1990, isNsman: true, residencyStatus: 'resident' },
      2026
    );
    expect(result.nsmanRelief).toBe(1500);
  });

  it('returns 0 nsman relief when isNsman is false', () => {
    const result = computeAutoReliefs(
      { birthYear: 1990, isNsman: false, residencyStatus: 'resident' },
      2026
    );
    expect(result.nsmanRelief).toBe(0);
  });

  it('returns 6000 earned income relief for resident aged 55–59', () => {
    const result = computeAutoReliefs(
      { birthYear: 1969, isNsman: false, residencyStatus: 'resident' },
      2026
    );
    expect(result.earnedIncomeRelief).toBe(6000);
  });
});

describe('calculateTax', () => {
  it('returns 0 for zero or negative income', () => {
    expect(calculateTax(0)).toBe(0);
    expect(calculateTax(-5000)).toBe(0);
  });

  it('returns 0 for income within the 0% bracket (≤20000)', () => {
    expect(calculateTax(1000)).toBe(0);
    expect(calculateTax(20000)).toBe(0);
  });

  it('applies 2% on the 20001–30000 band', () => {
    // 10000 * 0.02 = 200
    expect(calculateTax(30000)).toBe(200);
  });

  it('spans the 2% and 3.5% brackets correctly', () => {
    // 200 + 10000 * 0.035 = 550
    expect(calculateTax(40000)).toBe(550);
  });

  it('spans up through the 7% bracket', () => {
    // 200 + 350 + 40000 * 0.07 = 3350
    expect(calculateTax(80000)).toBeCloseTo(3350);
  });

  it('spans up through the 11.5% bracket', () => {
    // 3350 + 40000 * 0.115 = 7950
    expect(calculateTax(120000)).toBe(7950);
  });

  it('handles partial bracket correctly', () => {
    // 200 + 350 + 15100 * 0.07 = 1607
    expect(calculateTax(55100)).toBeCloseTo(1607);
  });

  it('matches the published YA2024 onwards top-bracket totals', () => {
    expect(calculateTax(500000)).toBe(84150);
    expect(calculateTax(1000000)).toBe(199150);
    expect(calculateTax(1100000)).toBe(223150);
  });

  it('uses calendar income year to preserve the historical top rate', () => {
    expect(calculateTax(1000000, 2022)).toBe(194150);
    expect(calculateTax(1000000, 2023)).toBe(199150);
  });

  it.each([320000, 500000, 1000000])(
    'handles the bracket boundary at %i',
    (boundary) => {
      const nextRate =
        boundary === 320000 ? 0.22 : boundary === 500000 ? 0.23 : 0.24;
      expect(calculateTax(boundary + 100) - calculateTax(boundary)).toBeCloseTo(
        100 * nextRate
      );
    }
  );
});

describe('getCpfMonthlyCeiling', () => {
  it('returns the correct ceiling for known years', () => {
    expect(getCpfMonthlyCeiling(2023, 9)).toBe(6300);
    expect(getCpfMonthlyCeiling(2024)).toBe(6800);
    expect(getCpfMonthlyCeiling(2025)).toBe(7400);
    expect(getCpfMonthlyCeiling(2026)).toBe(8000);
  });

  it('withholds unsupported future-year rules', () => {
    expect(getCpfMonthlyCeiling(2030)).toBeNull();
  });
});

describe('getCpfAnnualCeiling', () => {
  it('returns 102000 for all configured years', () => {
    expect(getCpfAnnualCeiling(2023)).toBe(102000);
    expect(getCpfAnnualCeiling(2026)).toBe(102000);
  });

  it('withholds unsupported annual rules', () => {
    expect(getCpfAnnualCeiling(2030)).toBeNull();
  });
});

describe('calculateMonthlyCpf', () => {
  it('applies 20% on salary below the monthly ceiling', () => {
    // 5000 * 0.2 = 1000
    expect(calculateMonthlyCpf(5000, 2026)).toBe(1000);
  });

  it('caps at the monthly ceiling and applies 20%', () => {
    // ceiling = 8000; 8000 * 0.2 = 1600
    expect(calculateMonthlyCpf(10000, 2026)).toBe(1600);
  });

  it('handles salary exactly at the ceiling', () => {
    expect(calculateMonthlyCpf(8000, 2026)).toBe(1600);
  });

  it('uses the correct ceiling for 2023', () => {
    // ceiling = 6300; 7000 → capped to 6300; 6300 * 0.2 = 1260
    expect(calculateMonthlyCpf(7000, 2023, 9)).toBe(1260);
  });
});

describe('calculateAnnualCpf', () => {
  it('calculates CPF on ordinary wages only when no bonus', () => {
    // owCapped = min(60000, 96000) = 60000; owCpf = 12000; awWages = 0
    expect(calculateAnnualCpf(60000, 60000, 2026)).toBe(12000);
  });

  it('caps ordinary wages at 12 × monthly ceiling', () => {
    // owCapped = min(120000, 96000) = 96000; owCpf = 19200; awWages = 0
    expect(calculateAnnualCpf(120000, 120000, 2026)).toBe(19200);
  });

  it('includes CPF on additional wages (bonus) up to the annual ceiling gap', () => {
    // owCapped = 72000; owCpf = 14400
    // awWages = 28000; awCeiling = 102000 - 72000 = 30000; awCpf = 5600
    expect(calculateAnnualCpf(72000, 100000, 2026)).toBe(19992);
  });

  it('caps additional wages when they exceed the annual ceiling remainder', () => {
    // owCapped = 96000; owCpf = 19200
    // awWages = 24000; awCeiling = 102000 - 96000 = 6000; awCapped = 6000; awCpf = 1200
    expect(calculateAnnualCpf(96000, 120000, 2026)).toBe(20400);
  });

  it('uses the correct monthly ceiling for 2023', () => {
    // monthly ceiling = 6300; owCapped = min(60000, 75600) = 60000; owCpf = 12000
    expect(calculateAnnualCpf(60000, 60000, 2023)).toBe(12000);
  });

  it('returns zero additional wage CPF when annual ceiling is fully consumed by OW', () => {
    // owCapped = 96000 (exactly at limit * 12); awCeiling = 102000 - 96000 = 6000
    // awWages = 0 → awCpf = 0
    expect(calculateAnnualCpf(96000, 96000, 2026)).toBe(19200);
  });
});

describe('calculateTaxSummary', () => {
  it('computes a full summary for a standard resident', () => {
    // Default profile: birthYear null, isNsman true
    // grossAnnual = 72000; totalCpf = 14400; taxReliefs = 2500; chargeableIncome = 55100
    // taxPayable = calculateTax(55100) = 1607
    const result = calculateTaxSummary(72000, 0, 2026);

    expect(result.grossAnnual).toBe(72000);
    expect(result.isNonResident).toBe(false);
    expect(result.totalCpf).toBe(14400);
    expect(result.earnedIncomeRelief).toBe(1000);
    expect(result.nsmanRelief).toBe(1500);
    expect(result.taxReliefs).toBe(2500);
    expect(result.chargeableIncome).toBe(55100);
    expect(result.taxPayable).toBeCloseTo(1607);
    expect(result.netAfterCpfAndTax).toBeCloseTo(72000 - 14400 - 1607);
  });

  it('includes bonus in gross income and CPF base', () => {
    // salary=60000, bonus=12000 → grossAnnual=72000; CPF includes AW contribution
    const result = calculateTaxSummary(60000, 12000, 2026);
    expect(result.grossAnnual).toBe(72000);
    // owCpf = 60000*0.2 = 12000; awCpf = 12000*0.2 = 2400
    expect(result.totalCpf).toBe(14400);
  });

  it('includes additional reliefs in chargeable income calculation', () => {
    const result = calculateTaxSummary(72000, 0, 2026, undefined, 5000);
    expect(result.additionalReliefs).toBe(5000);
    expect(result.taxReliefs).toBe(2500 + 5000);
    expect(result.chargeableIncome).toBe(55100 - 5000);
  });

  it('applies the higher of 15% or progressive tax to non-resident employment', () => {
    const profile = {
      birthYear: null,
      isNsman: false,
      residencyStatus: 'non_resident' as const,
    };
    const result = calculateTaxSummary(100000, 0, 2026, profile);

    expect(result.isNonResident).toBe(true);
    expect(result.earnedIncomeRelief).toBe(0);
    expect(result.nsmanRelief).toBe(0);
    expect(result.taxReliefs).toBe(0);
    expect(result.additionalReliefs).toBe(0);
    expect(result.chargeableIncome).toBe(100000);
    expect(result.taxPayable).toBe(15000);
    expect(result.effectiveRate).toBeCloseTo(0.15);
  });

  it('does not deduct CPF or personal reliefs from non-resident progressive tax', () => {
    const result = calculateTaxSummary(
      1000000,
      100000,
      2026,
      {
        birthYear: 1990,
        isNsman: true,
        residencyStatus: 'non_resident',
      },
      90000
    );
    expect(result.chargeableIncome).toBe(1100000);
    expect(result.taxPayable).toBe(223150);
    expect(result.additionalReliefs).toBe(0);
    expect(result.netAfterCpfAndTax).toBe(1100000 - result.totalCpf - 223150);
  });

  it.each([
    [57099, 70001],
    [57100, 70000],
    [90000, 70000],
  ])(
    'caps combined CPF and personal reliefs for claims of %i',
    (reliefs, chargeable) => {
      const result = calculateTaxSummary(
        96000,
        54000,
        2026,
        undefined,
        reliefs
      );
      expect(result.totalCpf).toBe(20400);
      expect(result.chargeableIncome).toBe(chargeable);
      expect(result.taxPayable).toBeCloseTo(550 + (chargeable - 40000) * 0.07);
    }
  );

  it('returns zero taxPayable and effectiveRate for zero income', () => {
    const result = calculateTaxSummary(0, 0, 2026);
    expect(result.grossAnnual).toBe(0);
    expect(result.taxPayable).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it('passes the income year through the summary calculation', () => {
    const profile = {
      birthYear: 1990,
      isNsman: false,
      residencyStatus: 'non_resident' as const,
    };
    expect(
      calculateTaxSummary(1000000, 0, 2022, profile, 0, 0).taxPayable
    ).toBe(194150);
    expect(calculateTaxSummary(1000000, 0, 2023, profile).taxPayable).toBe(
      199150
    );
  });

  it('introduces the personal relief cap with YA2018, not earlier income years', () => {
    const earlier = calculateTaxSummary(
      96000,
      54000,
      2016,
      undefined,
      90000,
      20400
    );
    const capped = calculateTaxSummary(
      96000,
      54000,
      2017,
      undefined,
      90000,
      20400
    );
    expect(earlier.chargeableIncome).toBe(37100);
    expect(capped.chargeableIncome).toBe(70000);
  });

  it('computes effectiveRate as taxPayable divided by grossAnnual', () => {
    const result = calculateTaxSummary(72000, 0, 2026);
    expect(result.effectiveRate).toBeCloseTo(
      result.taxPayable / result.grossAnnual
    );
  });

  it('uses age-60 relief tier when birthYear indicates 60+', () => {
    const profile = {
      birthYear: 1960,
      isNsman: false,
      residencyStatus: 'resident' as const,
    };
    const result = calculateTaxSummary(72000, 0, 2026, profile);
    expect(result.earnedIncomeRelief).toBe(8000);
  });
});

it('returns unavailable summary when CPF rules or inputs are unsupported', () => {
  expect(readTaxSummary(60000, 0, 2030)).toBeNull();
  expect(readTaxSummary(Number.MAX_VALUE, Number.MAX_VALUE, 2026)).toBeNull();
  expect(readTaxSummary(60000, 0, 2026, undefined, 0, -1)).toBeNull();
});

it.each([
  [500, 2026, 1, 0],
  [5000.99, 2026, 1, 1000],
  [7000, 2023, 8, 1200],
])(
  'corrects flat-rate, rounding or ceiling for wages %s in %s-%s',
  (wages, year, month, expected) => {
    expect(calculateMonthlyCpf(wages, year, month)).toBe(expected);
  }
);
