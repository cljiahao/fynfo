import { plannerSplitSchema } from '@/features/household/schemas';
import { parsePct } from '@/features/household/split-utils';
import { describe, expect, it } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const GOAL = '44444444-4444-4444-8444-444444444444';

const ok = (input: unknown) => plannerSplitSchema.safeParse(input).success;

describe('plannerSplitSchema', () => {
  it('accepts a split that totals 100 across two members', () => {
    expect(ok({ members: { [A]: 70, [B]: 30 }, goalOverrides: {} })).toBe(true);
    expect(ok({ members: { [A]: 100, [B]: 0 }, goalOverrides: {} })).toBe(true);
  });

  it('rejects a split that does not total 100', () => {
    expect(ok({ members: { [A]: 60, [B]: 30 }, goalOverrides: {} })).toBe(
      false
    );
  });

  it('rejects other than exactly two members', () => {
    expect(ok({ members: { [A]: 100 }, goalOverrides: {} })).toBe(false);
    expect(
      ok({ members: { [A]: 50, [B]: 25, [C]: 25 }, goalOverrides: {} })
    ).toBe(false);
  });

  it('rejects non-integer, negative and over-100 percentages', () => {
    expect(ok({ members: { [A]: 50.5, [B]: 49.5 }, goalOverrides: {} })).toBe(
      false
    );
    expect(ok({ members: { [A]: -10, [B]: 110 }, goalOverrides: {} })).toBe(
      false
    );
  });

  it('rejects non-uuid member ids', () => {
    expect(ok({ members: { x: 50, y: 50 }, goalOverrides: {} })).toBe(false);
  });

  it('validates overrides with the same rules and the same members', () => {
    const members = { [A]: 50, [B]: 50 };
    const withOverride = (override: Record<string, number>) =>
      ok({ members, goalOverrides: { [GOAL]: override } });
    expect(withOverride({ [A]: 20, [B]: 80 })).toBe(true);
    expect(withOverride({ [A]: 20, [B]: 70 })).toBe(false);
    expect(withOverride({ [A]: 20, [C]: 80 })).toBe(false);
  });
});

describe('parsePct', () => {
  it('accepts whole numbers 0 to 100 only', () => {
    expect(parsePct('0')).toBe(0);
    expect(parsePct('100')).toBe(100);
    expect(parsePct('')).toBeNull();
    expect(parsePct('50.5')).toBeNull();
    expect(parsePct('101')).toBeNull();
    expect(parsePct('-1')).toBeNull();
  });
});
