import { parseNumericInput } from '@/lib/utils/numeric-input';
import { describe, expect, it } from 'vitest';

describe('parseNumericInput', () => {
  it('returns null for empty or blank input', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('   ')).toBeNull();
  });

  it('parses integers and decimals', () => {
    expect(parseNumericInput('3500')).toBe(3500);
    expect(parseNumericInput('0.5')).toBe(0.5);
    expect(parseNumericInput('.5')).toBe(0.5);
    expect(parseNumericInput('1.')).toBe(1);
    expect(parseNumericInput('03500')).toBe(3500);
  });

  it('returns null for non-numeric or non-finite input', () => {
    expect(parseNumericInput('abc')).toBeNull();
    expect(parseNumericInput('1e999')).toBeNull();
    expect(parseNumericInput('-')).toBeNull();
    expect(parseNumericInput('.')).toBeNull();
    expect(parseNumericInput('1.2.3')).toBeNull();
  });
});
