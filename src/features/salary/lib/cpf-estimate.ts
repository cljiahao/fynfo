import {
  CPF_ANNUAL_WAGE_CEILING,
  CPF_EMPLOYEE_RATE,
  CPF_ORDINARY_WAGE_CEILINGS,
} from '../constants';
import type { SalaryData } from '../types';

export function ordinaryWageCeiling(
  year: number,
  month: number
): number | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (year === 2023) return month < 9 ? 6000 : 6300;
  return CPF_ORDINARY_WAGE_CEILINGS[year] ?? null;
}

/** Full-rate, age55-and-below employee model; this does not establish eligibility. */
export function employeeCpf(
  ordinary: number,
  additional: number,
  ceiling: number,
  paidAdditional = additional
): number | null {
  if (
    ![ordinary, additional, ceiling, paidAdditional].every(Number.isFinite) ||
    ordinary < 0 ||
    additional < 0 ||
    paidAdditional < additional ||
    ceiling <= 0
  )
    return null;
  const total = ordinary + paidAdditional;
  const subject = Math.min(ordinary, ceiling) + additional;
  if (!Number.isFinite(total) || !Number.isFinite(subject)) return null;
  // The published AW calculator does not establish phased bands after AW capping.
  if (total > 500 && total <= 750 && paidAdditional > additional) return null;
  const contribution =
    total <= 500
      ? 0
      : total <= 750
        ? 0.6 * (total - 500)
        : CPF_EMPLOYEE_RATE * subject;
  return Number.isFinite(contribution) ? Math.floor(contribution) : null;
}

/** Recorded-year AW limit is provisional until all employer OW is known. */
export function estimateRecordedCpf(
  records: SalaryData[],
  year: number
): number | null {
  if (ordinaryWageCeiling(year, 1) === null) return null;
  const seen = new Set<string>();
  let ordinaryTotal = 0;
  const rows = [];
  for (const record of records) {
    const match = /^(\d{4})-(\d{2})$/.exec(record.id);
    if (!match || Number(match[1]) !== year || seen.has(record.id)) return null;
    seen.add(record.id);
    const ceiling = ordinaryWageCeiling(year, Number(match[2]));
    if (
      ceiling === null ||
      ![record.salary, record.bonus].every(Number.isFinite) ||
      record.salary < 0 ||
      record.bonus < 0
    )
      return null;
    ordinaryTotal += Math.min(record.salary, ceiling);
    rows.push({ ...record, ceiling });
  }
  if (!Number.isFinite(ordinaryTotal)) return null;
  let additionalRemaining = Math.max(
    CPF_ANNUAL_WAGE_CEILING - ordinaryTotal,
    0
  );
  let contributionTotal = 0;
  for (const row of rows.sort((a, b) => a.id.localeCompare(b.id))) {
    const additional = Math.min(row.bonus, additionalRemaining);
    additionalRemaining -= additional;
    const contribution = employeeCpf(
      row.salary,
      additional,
      row.ceiling,
      row.bonus
    );
    if (contribution === null) return null;
    contributionTotal += contribution;
  }
  return Number.isFinite(contributionTotal) ? contributionTotal : null;
}

export function estimateAnnualCpf(
  annualSalary: number,
  annualBonus: number,
  year: number
): number | null {
  if (
    ![annualSalary, annualBonus].every(Number.isFinite) ||
    annualSalary < 0 ||
    annualBonus < 0
  )
    return null;
  return estimateRecordedCpf(
    Array.from({ length: 12 }, (_, index) => ({
      id: `${year}-${String(index + 1).padStart(2, '0')}`,
      salary: annualSalary / 12,
      bonus: annualBonus / 12,
    })),
    year
  );
}
