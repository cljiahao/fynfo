import { describe, expect, it } from 'vitest';
import { computeSalaryPlan } from '../lib/salary-plan';
import { scenarioPayloadSchema, scenarioRevisionSchema } from '../schemas';

const payload = {
  schemaVersion: 1,
  name: 'Synthetic plan',
  model: 'allocation-flat-cpf-v1',
  currency: 'SGD',
  capturedAt: '2026-10-10T00:00:00.000Z',
  inputs: {
    salary: 5000,
    expenses: 1500,
    emergencyMonths: 3.5,
    warChestMonths: 9,
    titheEnabled: true,
    tithePctInput: 10,
    allowanceEnabled: false,
    allowancePctInput: 5,
    currentSavings: -100,
    currentBonds: 2000,
  },
};
describe('scenario storage contract', () => {
  it('preserves all ten inputs, fractional months and negative captured balances', () => {
    const parsed = scenarioPayloadSchema.parse(payload);
    expect(parsed.inputs).toEqual(payload.inputs);
    expect(computeSalaryPlan(parsed.inputs)).toEqual(
      computeSalaryPlan(payload.inputs)
    );
  });
  it.each([
    { schemaVersion: 2 },
    { model: 'future' },
    { currency: 'USD' },
    { name: '   ' },
    { name: 'x'.repeat(81) },
    { capturedAt: '2026-10-10' },
    { extra: true },
  ])('rejects incompatible payload %o', (patch) => {
    expect(
      scenarioPayloadSchema.safeParse({ ...payload, ...patch }).success
    ).toBe(false);
  });
  it.each([
    { salary: Infinity },
    { expenses: -1 },
    { salary: 1e9 + 1 },
    { emergencyMonths: 121 },
    { tithePctInput: 101 },
    { currentBonds: -1e9 - 1 },
    { allowanceEnabled: 1 },
    { extra: true },
  ])('rejects invalid inputs %o', (patch) => {
    expect(
      scenarioPayloadSchema.safeParse({
        ...payload,
        inputs: { ...payload.inputs, ...patch },
      }).success
    ).toBe(false);
  });
  it.each([
    '0',
    '-1',
    '01',
    '1.0',
    '9223372036854775808',
    '99999999999999999999',
  ])('rejects unsafe revision %s', (revision) =>
    expect(scenarioRevisionSchema.safeParse(revision).success).toBe(false)
  );
  it('keeps bigint revisions as exact decimal text', () =>
    expect(scenarioRevisionSchema.parse('9223372036854775807')).toBe(
      '9223372036854775807'
    ));
});
