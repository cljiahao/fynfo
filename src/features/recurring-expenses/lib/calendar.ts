import { RECURRING_TIME_ZONE, THIRTY_DAY_MONTHS } from '../constants';
import type { RecurringTemplate } from '../types';

export function singaporeToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RECURRING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (key: string) =>
    parts.find((part) => part.type === key)?.value ?? '';
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
}
export function recurringDate(month: string, preferredDay: number): string {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    !Number.isInteger(preferredDay) ||
    preferredDay < 1 ||
    preferredDay > 31
  )
    throw new Error('Invalid recurring calendar');
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days =
    number === 2
      ? leap
        ? 29
        : 28
      : THIRTY_DAY_MONTHS.includes(number)
        ? 30
        : 31;
  return `${month}-${String(Math.min(preferredDay, days)).padStart(2, '0')}`;
}
export function occurrenceState(
  template: RecurringTemplate,
  month: string,
  today: string
): 'confirmed' | 'skipped' | 'inactive' | 'planned' | 'due' {
  const date = recurringDate(month, template.definition.preferredDay);
  const receipt = template.occurrences.find((entry) => entry.month === month);
  if (receipt) return receipt.outcome;
  const definition = template.definition;
  if (
    template.archived ||
    !definition.enabled ||
    month < definition.startMonth ||
    (definition.endMonth !== null && month > definition.endMonth)
  )
    return 'inactive';
  return date > today ? 'planned' : 'due';
}
export function previousRecurringMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error('Invalid recurring calendar');
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5));
  if (year === 0 && number === 1) return month;
  return number === 1
    ? `${String(year - 1).padStart(4, '0')}-12`
    : `${month.slice(0, 4)}-${String(number - 1).padStart(2, '0')}`;
}
