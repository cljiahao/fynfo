import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createScenario,
  deleteScenario,
  getScenarios,
  updateScenario,
} from '../actions/scenario-actions';
import { computeSalaryPlan } from '../lib/salary-plan';
const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/action-guard', () => ({ requireActionContext: mocks.context }));
const dek = Buffer.alloc(32, 3);
const id = '11111111-1111-4111-8111-111111111111';
const request = '22222222-2222-4222-8222-222222222222';
const payload = {
  schemaVersion: 1 as const,
  name: 'Synthetic plan',
  model: 'allocation-flat-cpf-v1' as const,
  currency: 'SGD' as const,
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
const row = () => ({
  id,
  creation_request_id: request,
  payload: encryptPayload(JSON.stringify(payload), dek),
  revision: '9007199254740993',
  created_at: payload.capturedAt,
  updated_at: payload.capturedAt,
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    userId: id,
    dek,
    supabase: { rpc: mocks.rpc },
  });
});
describe('encrypted scenario actions', () => {
  it.each([
    getScenarios,
    () => createScenario({ creationRequestId: request, payload }),
    () => updateScenario({ id, revision: '1', payload }),
    () => deleteScenario({ id, revision: '1' }),
  ])('requires unlocked identity before database access', async (action) => {
    mocks.context.mockRejectedValue(new Error('Locked'));
    await expect(action()).rejects.toThrow('Locked');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('encrypts name and all financial inputs and lets SQL generate row identity', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ status: 'CREATED', id, revision: '1' }],
      error: null,
    });
    expect(
      await createScenario({ creationRequestId: request, payload })
    ).toEqual({ status: 'CREATED', id, revision: '1' });
    const args = mocks.rpc.mock.calls[0][1];
    expect(Object.keys(args).sort()).toEqual([
      'p_creation_request_id',
      'p_payload',
    ]);
    expect(args.p_payload).not.toContain('Synthetic');
    expect(JSON.parse(decryptPayload(args.p_payload, dek))).toEqual(payload);
  });
  it.each(['EXISTING', 'CAPACITY'])(
    'returns %s without pretending to overwrite payload',
    async (status) => {
      mocks.rpc.mockResolvedValue({
        data: [{ status, id, revision: '1' }],
        error: null,
      });
      expect(
        (await createScenario({ creationRequestId: request, payload })).status
      ).toBe(status);
    }
  );
  it('passes exact decimal revisions to compare-save and compare-delete', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [{ status: 'SAVED', revision: '9007199254740994' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ status: 'DELETED' }], error: null });
    expect(
      await updateScenario({ id, revision: '9007199254740993', payload })
    ).toEqual({ status: 'SAVED', revision: '9007199254740994' });
    expect(await deleteScenario({ id, revision: '9007199254740994' })).toEqual({
      status: 'DELETED',
    });
    expect(mocks.rpc.mock.calls[0][1].p_expected_revision).toBe(
      '9007199254740993'
    );
  });
  it.each([
    () => updateScenario({ id, revision: '1', payload }),
    () => deleteScenario({ id, revision: '1' }),
  ])('preserves conflict result', async (action) => {
    mocks.rpc.mockResolvedValue({
      data: [{ status: 'CONFLICT' }],
      error: null,
    });
    expect(await action()).toEqual({ status: 'CONFLICT' });
  });
  it('decrypts complete valid snapshots without numeric revision coercion', async () => {
    mocks.rpc.mockResolvedValue({ data: [row()], error: null });
    const records = await getScenarios();
    expect(records[0].payload).toEqual(payload);
    expect(records[0].revision).toBe('9007199254740993');
  });
  it.each([
    null,
    [{ ...row(), payload: 'broken' }],
    [
      {
        ...row(),
        payload: encryptPayload(
          JSON.stringify({ ...payload, schemaVersion: 2 }),
          dek
        ),
      },
    ],
    Array.from({ length: 11 }, row),
  ])('rejects incomplete or corrupt reads atomically', async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getScenarios()).rejects.toThrow('Scenario unavailable');
  });
  it('rejects finite inputs whose computation overflows before RPC', async () => {
    await expect(
      createScenario({
        creationRequestId: request,
        payload: { ...payload, inputs: { ...payload.inputs, salary: 1e-320 } },
      })
    ).rejects.toThrow('Scenario unavailable');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { creationRequestId: 'bad', payload },
    { creationRequestId: request, payload: { ...payload, name: '' } },
  ])('rejects invalid input before SQL', async (input) => {
    await expect(createScenario(input)).rejects.toThrow('Scenario unavailable');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    [],
    null,
    [{ status: 'UNKNOWN' }],
    [{ status: 'CREATED', id, revision: 1 }],
  ])('rejects uncertain mutation responses', async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(
      createScenario({ creationRequestId: request, payload })
    ).rejects.toThrow('Scenario unavailable');
  });
  it('does not leak SQL error text', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'private constraint details', code: '23514' },
    });
    await expect(getScenarios()).rejects.toThrow('scenario read failed');
  });
});

it('rejects finite raw ratios whose displayed percentages overflow on create, save and read', async () => {
  const overflowing = {
    ...payload,
    inputs: { ...payload.inputs, salary: 1e-300, expenses: 1e8 },
  };
  const plan = computeSalaryPlan(overflowing.inputs);
  expect(
    Object.values(plan).every(
      (value) => typeof value !== 'number' || Number.isFinite(value)
    )
  ).toBe(true);
  expect(Number.isFinite(plan.expensesPct * 100)).toBe(false);
  await expect(
    createScenario({ creationRequestId: request, payload: overflowing })
  ).rejects.toThrow('Scenario unavailable');
  await expect(
    updateScenario({ id, revision: '1', payload: overflowing })
  ).rejects.toThrow('Scenario unavailable');
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({
    data: [
      { ...row(), payload: encryptPayload(JSON.stringify(overflowing), dek) },
    ],
    error: null,
  });
  await expect(getScenarios()).rejects.toThrow('Scenario unavailable');
});
