import { isAdminEmail, parseAdminEmails } from '@/lib/admin';
import { describe, expect, it } from 'vitest';

describe('parseAdminEmails', () => {
  it('returns [] for nullish / blank input', () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails(null)).toEqual([]);
    expect(parseAdminEmails('')).toEqual([]);
    expect(parseAdminEmails('   ')).toEqual([]);
  });

  it('splits, trims, lowercases, and drops blanks', () => {
    expect(parseAdminEmails(' A@x.com , b@x.com ,, C@X.com ')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
    ]);
  });
});

describe('isAdminEmail', () => {
  const allow = 'clarence@example.com, ops@example.com';

  it('is true for a listed email (case-insensitive)', () => {
    expect(isAdminEmail('clarence@example.com', allow)).toBe(true);
    expect(isAdminEmail('CLARENCE@example.com', allow)).toBe(true);
    expect(isAdminEmail('  ops@example.com ', allow)).toBe(true);
  });

  it('is false for unlisted email, blank email, or no allowlist', () => {
    expect(isAdminEmail('stranger@example.com', allow)).toBe(false);
    expect(isAdminEmail('clarence@example.com', undefined)).toBe(false);
    expect(isAdminEmail('clarence@example.com', '')).toBe(false);
    expect(isAdminEmail('', allow)).toBe(false);
    expect(isAdminEmail(null, allow)).toBe(false);
  });
});
