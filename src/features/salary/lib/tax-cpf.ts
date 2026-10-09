import {
  CPF_ANNUAL_CEILING,
  CPF_EMPLOYEE_RATE,
  CPF_MONTHLY_CEILING,
  HISTORICAL_TAX_BRACKETS,
  NON_RESIDENT_RATE,
  PERSONAL_RELIEF_CAP,
  TAX_BRACKETS,
} from '../constants';

// Earned income relief by age tier
export function getEarnedIncomeRelief(age: number | null): number {
  if (age === null) return 1000;
  if (age >= 60) return 8000;
  if (age >= 55) return 6000;
  return 1000;
}

export interface TaxProfileContext {
  birthYear: number | null;
  isNsman: boolean;
  residencyStatus: 'resident' | 'non_resident';
}

const DEFAULT_PROFILE: TaxProfileContext = {
  birthYear: null,
  isNsman: true,
  residencyStatus: 'resident',
};

export function computeAutoReliefs(
  profile: TaxProfileContext,
  year: number
): { earnedIncomeRelief: number; nsmanRelief: number } {
  if (profile.residencyStatus === 'non_resident') {
    return { earnedIncomeRelief: 0, nsmanRelief: 0 };
  }

  const age = profile.birthYear ? year - profile.birthYear : null;
  return {
    earnedIncomeRelief: getEarnedIncomeRelief(age),
    nsmanRelief: profile.isNsman ? 1500 : 0,
  };
}

// Without a calendar income year, use the current resident rate table.
export function calculateTax(
  chargeableIncome: number,
  incomeYear?: number
): number {
  if (chargeableIncome <= 0) return 0;

  let tax = 0;
  let prev = 0;

  const brackets =
    incomeYear !== undefined && incomeYear < 2023
      ? HISTORICAL_TAX_BRACKETS
      : TAX_BRACKETS;
  for (const bracket of brackets) {
    const taxable = Math.min(chargeableIncome, bracket.upTo) - prev;
    if (taxable <= 0) break;
    tax += taxable * bracket.rate;
    prev = bracket.upTo;
  }

  return tax;
}

export function getCpfMonthlyCeiling(year: number): number {
  return CPF_MONTHLY_CEILING[year] ?? CPF_MONTHLY_CEILING[2026];
}

export function getCpfAnnualCeiling(year: number): number {
  return CPF_ANNUAL_CEILING[year] ?? CPF_ANNUAL_CEILING[2026];
}

export function calculateMonthlyCpf(
  monthlySalary: number,
  year: number
): number {
  const ceiling = getCpfMonthlyCeiling(year);
  const capped = Math.min(monthlySalary, ceiling);
  return capped * CPF_EMPLOYEE_RATE;
}

export function calculateAnnualCpf(
  annualOrdinaryWages: number,
  annualTotalWages: number,
  year: number
): number {
  const monthlyCeiling = getCpfMonthlyCeiling(year);
  const owCapped = Math.min(annualOrdinaryWages, monthlyCeiling * 12);
  const owCpf = owCapped * CPF_EMPLOYEE_RATE;

  const annualCeiling = getCpfAnnualCeiling(year);
  const awWages = annualTotalWages - annualOrdinaryWages;
  const awCeiling = Math.max(annualCeiling - owCapped, 0);
  const awCapped = Math.min(awWages, awCeiling);
  const awCpf = awCapped * CPF_EMPLOYEE_RATE;

  return owCpf + awCpf;
}

export interface TaxSummary {
  grossAnnual: number;
  totalCpf: number;
  earnedIncomeRelief: number;
  nsmanRelief: number;
  additionalReliefs: number;
  taxReliefs: number;
  chargeableIncome: number;
  taxPayable: number;
  effectiveRate: number;
  netAfterCpfAndTax: number;
  isNonResident: boolean;
}

export function calculateTaxSummary(
  annualSalary: number,
  annualBonus: number,
  year: number,
  profile: TaxProfileContext = DEFAULT_PROFILE,
  additionalReliefs: number = 0
): TaxSummary {
  const grossAnnual = annualSalary + annualBonus;
  const isNonResident = profile.residencyStatus === 'non_resident';

  const totalCpf = calculateAnnualCpf(annualSalary, grossAnnual, year);

  const autoReliefs = computeAutoReliefs(profile, year);
  const earnedIncomeRelief = autoReliefs.earnedIncomeRelief;
  const nsmanRelief = autoReliefs.nsmanRelief;
  const taxReliefs = isNonResident
    ? 0
    : earnedIncomeRelief + nsmanRelief + additionalReliefs;

  // CPF shares the overall relief cap, introduced in YA2018 (income year2017).
  const reliefCap = year >= 2017 ? PERSONAL_RELIEF_CAP : Infinity;
  const allowedReliefs = isNonResident
    ? 0
    : Math.min(totalCpf + taxReliefs, reliefCap);
  const chargeableIncome = Math.max(grossAnnual - allowedReliefs, 0);

  let taxPayable: number;
  if (isNonResident) {
    const flatTax = grossAnnual * NON_RESIDENT_RATE;
    const progressiveTax = calculateTax(chargeableIncome, year);
    taxPayable = Math.max(flatTax, progressiveTax);
  } else {
    taxPayable = calculateTax(chargeableIncome, year);
  }

  const effectiveRate = grossAnnual > 0 ? taxPayable / grossAnnual : 0;
  const netAfterCpfAndTax = grossAnnual - totalCpf - taxPayable;

  return {
    grossAnnual,
    totalCpf,
    earnedIncomeRelief,
    nsmanRelief,
    additionalReliefs: isNonResident ? 0 : additionalReliefs,
    taxReliefs,
    chargeableIncome,
    taxPayable,
    effectiveRate,
    netAfterCpfAndTax,
    isNonResident,
  };
}
