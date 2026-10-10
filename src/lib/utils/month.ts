import { format, parse } from 'date-fns';

export function formatRecordedMonth(month: string): string {
  if (
    !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month) ||
    month.slice(0, 4) === '0000'
  ) {
    return `${month} (invalid month)`;
  }
  return format(parse(month, 'yyyy-MM', new Date()), 'MMM yyyy');
}
