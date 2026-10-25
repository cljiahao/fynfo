import { importedExpenseValues } from '@/features/expenses/lib/import-expense';
import { checkImportOutcome } from '@/features/import-review/lib/import-outcomes';
import {
  createImportInput,
  savedImportMatches,
  statementImportMatches,
} from '@/features/import-review/lib/import-selection';
import { parseStatementLines } from '@/features/import-review/lib/statement-parser';
import { describe, expect, it } from 'vitest';
const period = { from: '2026-10-01', to: '2026-10-31' };
const id = 'a3610806-7c64-4a2a-9a3d-1842d82c993d';
function rows(...text: string[]) {
  return parseStatementLines(
    ['UOB SGD billed', ...text].map((text, index) => ({
      page: 1,
      line: index + 1,
      text,
    })),
    'uob',
    period
  );
}
describe('import eligibility and warnings', () => {
  it('preserves original source after edits and maps cents exactly', () => {
    const row = rows('01 OCT MARKET 12.30')[0];
    const input = createImportInput(
      { ...row, description: 'Corrected merchant' },
      'uob',
      period,
      id
    )!;
    expect(input.cents).toBe(1230);
    expect(input.source[0].text).toBe('01 OCT MARKET 12.30');
    expect(importedExpenseValues(input).info).toBe('');
    const noted = createImportInput(
      { ...row, note: '  Lunch with team  ' },
      'uob',
      period,
      id
    )!;
    expect(importedExpenseValues(noted).info).toBe('Lunch with team');
    expect(importedExpenseValues(input).item).toBe('Corrected merchant');
  });
  it.each([
    '01 OCT REFUND SGD 12.30',
    '01 OCT SHOP SGD 12.30 CR',
    '01 OCT TOTAL BALANCE SGD 12.30',
    '01 OCT SHOP USD 12.30',
  ])(
    'cannot unblock immutable source restriction with positive expense override: %s',
    (text) => {
      const row = rows(text)[0];
      expect(
        createImportInput(
          { ...row, classification: 'expense', amount: '12.30' },
          'uob',
          period,
          id
        )
      ).toBeNull();
    }
  );
  it('allows review of duplicate warnings but not other source issues', () => {
    const [row] = rows('01 OCT MARKET 12.30', '01 OCT MARKET 12.30');
    expect(createImportInput(row, 'uob', period, id)).not.toBeNull();
    expect(
      createImportInput(
        { ...row, issues: [...row.issues, 'Currency is unresolved.'] },
        'uob',
        period,
        id
      )
    ).toBeNull();
  });
  it('flags same selection and existing shared matches without changing or dropping inputs', () => {
    const input = createImportInput(
      rows('01 OCT MARKET 12.30')[0],
      'uob',
      period,
      id
    )!;
    const other = {
      ...input,
      id: '8e39d71b-59aa-44a0-83a4-1ba1e1347903',
      description: '  market  ',
    };
    expect(
      statementImportMatches([
        { key: 'a', input },
        { key: 'b', input: other },
      ])
    ).toEqual(
      new Map([
        ['a', 'b'],
        ['b', 'a'],
      ])
    );
    expect(
      savedImportMatches(
        [input],
        [{ ...importedExpenseValues(input), id: 'saved', splitType: 'shared' }]
      )
    ).toEqual(
      new Map([
        [
          id,
          { kind: 'saved', date: '2026-10-01', item: 'MARKET', amount: 12.3 },
        ],
      ])
    );
    expect(
      savedImportMatches(
        [input],
        [{ ...importedExpenseValues(input), date: '2026-10-02' }]
      ).size
    ).toBe(0);
  });
  it('checks exact match, conflict and missing outcome without constructing a replacement', () => {
    const input = createImportInput(
      rows('01 OCT MARKET 12.30')[0],
      'uob',
      period,
      id
    )!;
    expect(checkImportOutcome(input, [])).toBe('unconfirmed');
    expect(checkImportOutcome(input, [importedExpenseValues(input)])).toBe(
      'confirmed'
    );
    expect(
      checkImportOutcome(input, [
        { ...importedExpenseValues(input), amount: 13 },
      ])
    ).toBe('conflict');
  });
});
