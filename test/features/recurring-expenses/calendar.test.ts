import {
  occurrenceState,
  previousRecurringMonth,
  recurringDate,
  singaporeToday,
} from '@/features/recurring-expenses/lib/calendar';
import type { RecurringTemplate } from '@/features/recurring-expenses/types';
import { describe, expect, it } from 'vitest';
const template: RecurringTemplate = {
  definition: {
    id: '13800000-0000-4000-8000-000000000001',
    name: 'Monthly bill',
    enabled: true,
    preferredDay: 31,
    startMonth: '2026-01',
    endMonth: null,
    cents: 5000,
    category: 'bills',
    item: 'Synthetic bill',
    info: '',
  },
  archived: false,
  occurrences: [],
};
describe('Singapore monthly calendar', () => {
  it.each([
    ['2026-01', '31'],
    ['2026-02', '28'],
    ['2028-02', '29'],
    ['1900-02', '28'],
    ['2000-02', '29'],
    ['2026-03', '31'],
    ['2026-04', '30'],
  ])(
    'clamps preferred day31 in %s without changing the preference',
    (month, day) => {
      expect(recurringDate(month, 31)).toBe(`${month}-${day}`);
      expect(template.definition.preferredDay).toBe(31);
    }
  );
  it.each([
    ['2026-12-31T15:59:59.000Z', '2026-12-31'],
    ['2026-12-31T16:00:00.000Z', '2027-01-01'],
    ['2026-02-28T16:00:00.000Z', '2026-03-01'],
  ])('uses Singapore midnight at %s', (now, date) =>
    expect(singaporeToday(new Date(now))).toBe(date)
  );
  it('keeps future days/months planned and inclusive active months bounded', () => {
    expect(occurrenceState(template, '2026-01', '2026-01-30')).toBe('planned');
    expect(occurrenceState(template, '2026-01', '2026-01-31')).toBe('due');
    expect(occurrenceState(template, '2026-02', '2026-02-28')).toBe('due');
    expect(occurrenceState(template, '2025-12', '2026-02-28')).toBe('inactive');
    const bounded = {
      ...template,
      definition: { ...template.definition, endMonth: '2026-02' },
    };
    expect(occurrenceState(bounded, '2026-02', '2026-03-31')).toBe('due');
    expect(occurrenceState(bounded, '2026-03', '2026-03-31')).toBe('inactive');
  });
  it('disabling/re-enabling changes suggestions but never terminal history', () => {
    const disabled = {
      ...template,
      definition: { ...template.definition, enabled: false },
    };
    expect(occurrenceState(disabled, '2026-02', '2026-03-31')).toBe('inactive');
    expect(occurrenceState(template, '2026-02', '2026-03-31')).toBe('due');
    const recorded: RecurringTemplate = {
      ...disabled,
      archived: true,
      occurrences: [
        {
          month: '2026-02',
          requestId: '13800000-0000-4000-8000-000000000002',
          outcome: 'skipped',
          expense: null,
        },
      ],
    };
    expect(occurrenceState(recorded, '2026-02', '2026-03-31')).toBe('skipped');
  });
  it('navigates earlier months and year rollover without creating anything', () => {
    expect(previousRecurringMonth('2026-01')).toBe('2025-12');
    expect(previousRecurringMonth('2026-02')).toBe('2026-01');
    expect(previousRecurringMonth('0000-01')).toBe('0000-01');
    expect(template.occurrences).toEqual([]);
  });
  it.each([
    ['2026-13', 1],
    ['2026-02', 0],
    ['2026-02', 32],
    ['2026-02', 2.5],
  ])('rejects invalid calendar %s/%s', (month, day) =>
    expect(() => recurringDate(String(month), Number(day))).toThrow()
  );
});
