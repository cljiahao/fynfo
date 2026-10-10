import {
  parsePastedRow,
  tryParseCategory,
  tryParseDate,
} from '@/features/expenses/lib/paste-parser';
import { describe, expect, it } from 'vitest';

describe('tryParseDate', () => {
  it('parses ISO yyyy-MM-dd', () => {
    expect(tryParseDate('2026-04-07')).toBe('2026-04-07');
  });

  it('parses dd/MM/yyyy (SG convention preferred)', () => {
    expect(tryParseDate('07/04/2026')).toBe('2026-04-07');
  });

  it('returns null for non-dates', () => {
    expect(tryParseDate('Grab')).toBeNull();
  });
});

describe('tryParseCategory', () => {
  it('matches a category key (food_drink)', () => {
    expect(tryParseCategory('food_drink')).toBe('food_drink');
  });

  it('returns null for an unknown category', () => {
    expect(tryParseCategory('zzz')).toBeNull();
  });
});

describe('parsePastedRow', () => {
  it('matches columns by content regardless of order', () => {
    const row = parsePastedRow('2026-04-07\tGrab\t12.50');
    expect(row.date).toBe('2026-04-07');
    expect(row.amount).toBe('12.5');
    expect(row.item).toBe('Grab');
  });

  it('skips header-like tokens', () => {
    const row = parsePastedRow('date\tamount');
    expect(row.date).toBeUndefined();
    expect(row.amount).toBeUndefined();
  });
});

it.each([
  ['04/27/2026', '2026-04-27'],
  ['Apr 7, 2026', '2026-04-07'],
  ['2026-99-99', null],
  ['99/99/2026', null],
  ['food & drink', 'food_drink'],
  ['trans', 'transport'],
])('handles date/category boundary %s', (value, expected) => {
  if (value === 'food & drink' || value === 'trans')
    expect(tryParseCategory(value)).toBe(expected);
  else expect(tryParseDate(value)).toBe(expected);
});
it('parses reordered category, currency amount, item and notes without confusing headers', () => {
  expect(
    parsePastedRow('category\t$1,200.50\tShopping\t2026-10-08\tStore\tGifts')
  ).toEqual({
    date: '2026-10-08',
    amount: '1200.5',
    type: 'shopping',
    item: 'Store',
    info: 'Gifts',
  });
});

it.each(['2026-02-30', '31/04/2026', '2025-02-29', '10.20', '12.00', '2026'])(
  'rejects rollover and numeric date %s',
  (value) => {
    expect(tryParseDate(value)).toBeNull();
  }
);
it.each([
  '$1,2.3',
  '1.2.3',
  '1,2.50',
  '9'.repeat(400),
  '0',
  '-12.50',
  '12.50 CR',
])('retains invalid money issue without a partial amount %s', (value) => {
  const row = parsePastedRow(`2026-10-01\tCafe\t${value}`);
  expect(row.amount).toBeUndefined();
  expect(row).toHaveProperty('issues');
});
it('retains an impossible date issue while accepting the valid amount', () => {
  expect(parsePastedRow('2026-02-30\tCafe\t12.50')).toMatchObject({
    amount: '12.5',
    issues: [{ field: 'date', code: 'INVALID_DATE' }],
  });
});

it.each([
  ['2024-02-29', '2024-02-29'],
  ['2026-4-7', '2026-04-07'],
  ['7 Apr 2026', '2026-04-07'],
  ['April 7, 2026', '2026-04-07'],
  ['29/02/2024', '2024-02-29'],
  ['04/27/2026', '2026-04-27'],
  ['02/30/2026', null],
  ['30/02/2026', null],
  ['Apr 31, 2026', null],
])('qualifies literal calendar dates %s', (input, expected) => {
  expect(tryParseDate(input)).toBe(expected);
});
it.each(['.50', '$ .50', '1.', '10.20', '12.12345', '1,200.50'])(
  'keeps complete positive money %s',
  (input) => {
    const row = parsePastedRow(`Cafe\t${input}`);
    expect(row.amount).toBe(String(Number(input.replace(/[$,]/g, '').trim())));
    expect(row.date).toBeUndefined();
    expect(row.issues).toBeUndefined();
  }
);
it('keeps ordinary numeric merchant labels and omitted amounts as editable text', () => {
  expect(parsePastedRow('7Eleven\tLunch')).toEqual({
    item: '7Eleven',
    info: 'Lunch',
  });
  expect(parsePastedRow('date\ttype\titem\tamount')).toEqual({});
});

it.each(['$oops', '1e3', 'Infinity', 'NaN', '12.50 DR'])(
  'does not lose malformed explicit money %s',
  (value) => {
    expect(parsePastedRow(`2026-10-01\tCafe\t${value}`)).toMatchObject({
      issues: [{ field: 'amount', code: 'INVALID_AMOUNT' }],
    });
  }
);

it.each(['Apr 7,2026', '7 April,2026'])(
  'preserves explicit named month comma formats %s',
  (value) => {
    expect(tryParseDate(value)).toBe('2026-04-07');
  }
);
it('distinguishes invalid named dates from ordinary named notes', () => {
  expect(parsePastedRow('Apr 31,2026\tCafe\t12.50')).toMatchObject({
    issues: [{ field: 'date', code: 'INVALID_DATE' }],
  });
  expect(parsePastedRow('Cafe 31,2026\tLunch')).toEqual({
    item: 'Cafe 31,2026',
    info: 'Lunch',
  });
});

it.each(['7-11', '123-456'])(
  'preserves numeric merchant/reference text %s',
  (item) => {
    expect(parsePastedRow(`2026-10-01\t${item}\t12.50`)).toEqual({
      date: '2026-10-01',
      item,
      amount: '12.5',
    });
  }
);

it.each(['-12.50', '$-12.50', '(-12.50)', '(12.50)'])(
  'retains unsupported signed/parenthesized money %s',
  (value) => {
    expect(parsePastedRow(`2026-10-01\tCafe\t${value}`)).toMatchObject({
      issues: [{ field: 'amount', code: 'UNSUPPORTED_CREDIT' }],
    });
  }
);

it.each(['Sept 7, 2026', '7 Sept 2026', 'Sept 7,2026'])(
  'preserves September short alias %s',
  (value) => {
    expect(tryParseDate(value)).toBe('2026-09-07');
  }
);
