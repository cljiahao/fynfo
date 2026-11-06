import { toSalaryData } from '@/features/salary/lib/income-aggregates';
import type { IncomeLine, SalaryData } from '@/features/salary/types';

/** A month in the legacy shape: one salary line plus a bonus line when set. */
export function salaryRow(
  id: string,
  salary: number,
  bonus: number
): SalaryData {
  const lines: IncomeLine[] = [];
  if (salary > 0 || bonus <= 0) {
    lines.push({
      id: `${id}-s`,
      type: 'salary',
      label: 'Salary',
      amount: salary,
    });
  }
  if (bonus > 0) {
    lines.push({ id: `${id}-b`, type: 'bonus', label: 'Bonus', amount: bonus });
  }
  return toSalaryData(id, lines);
}

/** The month payload the two-field salary form submits. */
export function savedMonth(id: string, salary: number, bonus: number) {
  const lines: IncomeLine[] = [];
  if (salary > 0) {
    lines.push({
      id: 'salary-0',
      type: 'salary',
      label: 'Salary',
      amount: salary,
    });
  }
  if (bonus > 0) {
    lines.push({
      id: `bonus-${lines.length}`,
      type: 'bonus',
      label: 'Bonus',
      amount: bonus,
    });
  }
  return { id, lines };
}
