import {
  CPF_ANNUAL_WAGE_CEILING,
  CPF_EMPLOYEE_RATE,
  CPF_ORDINARY_WAGE_CEILINGS,
} from '../constants';
import type { IncomeLine, SalaryData } from '../types';
import { recurringByEmployer, summarizeMonth } from './income-aggregates';

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

export type CpfMonthInput = Pick<SalaryData, 'id' | 'salary' | 'bonus'> & {
  lines?: readonly IncomeLine[];
};

interface MonthWages {
  employers: number[];
  bonus: number;
}

/** Months without lines (legacy rows, annual projection) are one unnamed employer. */
function monthWages(record: CpfMonthInput): MonthWages | null {
  if (record.lines && record.lines.length > 0) {
    if (
      !record.lines.every(
        (line) => Number.isFinite(line.amount) && line.amount >= 0
      )
    )
      return null;
    const summary = summarizeMonth(record.lines);
    return {
      employers: [...recurringByEmployer(record.lines).values()],
      bonus: summary.bonus,
    };
  }
  if (
    ![record.salary, record.bonus].every(Number.isFinite) ||
    record.salary < 0 ||
    record.bonus < 0
  )
    return null;
  return { employers: [record.salary], bonus: record.bonus };
}

/**
 * Recorded-year AW limit is provisional until all employer OW is known.
 * The OW ceiling applies to each employer separately; one-time lines carry no CPF.
 */
export function estimateRecordedCpf(
  records: readonly CpfMonthInput[],
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
    const wages = monthWages(record);
    if (ceiling === null || wages === null) return null;
    for (const amount of wages.employers)
      ordinaryTotal += Math.min(amount, ceiling);
    rows.push({ id: record.id, ceiling, ...wages });
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
    // AW has no employer link, so it rides on the largest employer's wage band.
    const employers = row.employers.length > 0 ? [...row.employers] : [0];
    const lead = employers.indexOf(Math.max(...employers));
    for (let index = 0; index < employers.length; index += 1) {
      const isLead = index === lead;
      const contribution = employeeCpf(
        employers[index],
        isLead ? additional : 0,
        row.ceiling,
        isLead ? row.bonus : 0
      );
      if (contribution === null) return null;
      contributionTotal += contribution;
    }
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
