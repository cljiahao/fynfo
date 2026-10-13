import {
  merchantRulebookPayloadSchema,
  merchantRuleSchema,
  merchantRulesSchema,
} from '@/features/merchant-rules/schemas';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/expenses', async () => ({
  EXPENSE_TYPE_LABELS: (await import('@/features/expenses/constants'))
    .EXPENSE_TYPE_LABELS,
}));
const rule = {
  id: '851af27a-e752-4aa5-8294-44b02bd911ca',
  label: ' Example ',
  enabled: true,
  matchMode: 'exact',
  matchText: '  Café ',
  bank: null,
  displayName: 'Café',
  category: 'food_drink',
};
const payload = {
  schemaVersion: 1,
  requestId: 'ff65feb2-8ffa-427c-a057-8779580f162f',
  rules: [rule],
};

describe('merchant rule boundaries', () => {
  it('preserves all entered text rather than normalizing persisted values', () => {
    expect(merchantRulebookPayloadSchema.parse(payload)).toEqual(payload);
  });
  it.each([
    { label: '' },
    { label: '  ' },
    { label: 'x'.repeat(257) },
    { matchText: '---' },
    { matchText: 'x'.repeat(257) },
    { displayName: '' },
    { displayName: 'x'.repeat(257) },
    { displayName: null, category: null },
    { category: 'toString' },
    { category: 'unknown' },
    { bank: 'unknown' },
    { matchMode: 'regex' },
    { enabled: 'true' },
    { id: 'source:1:2' },
    { amount: 10 },
    { classification: 'expense' },
    { userId: 'some-owner' },
  ])('rejects unsupported fields or values: %j', (change) => {
    expect(merchantRuleSchema.safeParse({ ...rule, ...change }).success).toBe(
      false
    );
  });
  it('supports either suggested field independently and disabled rules', () => {
    expect(
      merchantRuleSchema.safeParse({
        ...rule,
        displayName: null,
        enabled: false,
      }).success
    ).toBe(true);
    expect(
      merchantRuleSchema.safeParse({ ...rule, category: null }).success
    ).toBe(true);
  });
  it('rejects duplicate identities and more than 100 rules', () => {
    expect(merchantRulesSchema.safeParse([rule, rule]).success).toBe(false);
    const rules = Array.from({ length: 101 }, (_, i) => ({
      ...rule,
      id: `851af27a-e752-4aa5-8294-${String(i).padStart(12, '0')}`,
    }));
    expect(merchantRulesSchema.safeParse(rules).success).toBe(false);
    expect(merchantRulesSchema.safeParse(rules.slice(0, 100)).success).toBe(
      true
    );
  });
  it('bounds UTF-8 payload size, including escaped JSON strings', () => {
    const rules = Array.from({ length: 100 }, (_, i) => ({
      ...rule,
      id: `851af27a-e752-4aa5-8294-${String(i).padStart(12, '0')}`,
      label: '界'.repeat(256),
      matchText: '界'.repeat(256),
      displayName: '界'.repeat(256),
    }));
    expect(
      merchantRulebookPayloadSchema.safeParse({ ...payload, rules }).success
    ).toBe(false);
  });
  it('accepts an empty retained rulebook and rejects unknown envelope versions/fields', () => {
    expect(
      merchantRulebookPayloadSchema.safeParse({ ...payload, rules: [] }).success
    ).toBe(true);
    expect(
      merchantRulebookPayloadSchema.safeParse({ ...payload, schemaVersion: 2 })
        .success
    ).toBe(false);
    expect(
      merchantRulebookPayloadSchema.safeParse({ ...payload, owner: 'unknown' })
        .success
    ).toBe(false);
  });
});
