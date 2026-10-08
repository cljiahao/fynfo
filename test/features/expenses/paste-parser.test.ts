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
