import {
  getMerchantRulebook,
  saveMerchantRulebook,
} from '@/features/merchant-rules/actions/rulebook-actions';
import { checkRulebookSave } from '@/features/merchant-rules/lib/rulebook-state';
import type { SaveRulebookInput } from '@/features/merchant-rules/types';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';

const mock = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('@/lib/action-guard', () => ({ requireActionContext: mock.context }));
vi.mock('@/features/expenses', async () => ({
  EXPENSE_TYPE_LABELS: (await import('@/features/expenses/constants'))
    .EXPENSE_TYPE_LABELS,
}));
const key = Buffer.alloc(32, 9);
const input: SaveRulebookInput = {
  id: '851af27a-e752-4aa5-8294-44b02bd911ca',
  expectedRevision: '0',
  payload: {
    schemaVersion: 1,
    requestId: 'ff65feb2-8ffa-427c-a057-8779580f162f',
    rules: [
      {
        id: '28df2170-47da-4771-90cc-9aa36eff48d5',
        label: 'Synthetic merchant',
        enabled: true,
        matchMode: 'exact',
        matchText: 'MARKET',
        bank: 'uob',
        displayName: 'Market',
        category: 'groceries',
      },
    ],
  },
};
function setup(options: Parameters<typeof makeFakeSupabase>[0] = {}) {
  const fake = makeFakeSupabase(options);
  mock.context.mockResolvedValue({
    userId: 'synthetic-owner',
    dek: key,
    supabase: fake.client,
  });
  return fake;
}
beforeEach(() => vi.clearAllMocks());

describe('guarded encrypted merchant rulebook', () => {
  it('writes only ciphertext through CAS with lossless revision and no caller owner', async () => {
    const fake = setup({
      rpcData: {
        compare_save_personal_merchant_rulebook: [
          { status: 'SAVED', revision: '9007199254740994' },
        ],
      },
    });
    expect(
      await saveMerchantRulebook({
        ...input,
        expectedRevision: '9007199254740993',
      })
    ).toEqual({ status: 'saved', revision: '9007199254740994' });
    const args = fake.calls.rpc[0].args as Record<string, string>;
    expect(Object.keys(args).sort()).toEqual([
      'p_expected_revision',
      'p_id',
      'p_payload',
    ]);
    expect(args.p_expected_revision).toBe('9007199254740993');
    expect(args.p_payload).not.toContain('MARKET');
    expect(JSON.parse(decryptPayload(args.p_payload, key))).toEqual(
      input.payload
    );
    expect(fake.calls.insert).toHaveLength(0);
    expect(fake.calls.update).toHaveLength(0);
  });
  it.each([
    { ...input, user_id: 'other' },
    { ...input, expectedRevision: '9223372036854775807' },
    { ...input, expectedRevision: 1 },
    {
      ...input,
      payload: {
        ...input.payload,
        rules: [input.payload.rules[0], input.payload.rules[0]],
      },
    },
  ])('rejects malformed input before database access', async (bad) => {
    const fake = setup();
    expect(await saveMerchantRulebook(bad)).toEqual({ status: 'not_saved' });
    expect(mock.context).not.toHaveBeenCalled();
    expect(fake.calls.rpc).toHaveLength(0);
  });
  it('does not access data when the identity/vault gate fails', async () => {
    const fake = setup();
    mock.context.mockRejectedValue(new Error('locked'));
    expect(await saveMerchantRulebook(input)).toEqual({ status: 'not_saved' });
    expect(fake.calls.rpc).toHaveLength(0);
    await expect(getMerchantRulebook()).rejects.toThrow();
    expect(fake.calls.from).toHaveLength(0);
  });
  it('returns conflict without exposing a different owner or database details', async () => {
    setup({
      rpcData: {
        compare_save_personal_merchant_rulebook: [
          { status: 'CONFLICT', revision: null },
        ],
      },
    });
    expect(await saveMerchantRulebook(input)).toEqual({ status: 'conflict' });
  });
  it.each([
    null,
    [],
    [{ status: 'SAVED', revision: '2' }],
    [{ status: 'SAVED', revision: 1 }],
    [{ status: 'SAVED', revision: '1', extra: 'secret' }],
  ])('retains unknown outcome on malformed acknowledgement', async (data) => {
    setup({ rpcData: { compare_save_personal_merchant_rulebook: data } });
    expect(await saveMerchantRulebook(input)).toEqual({
      status: 'unconfirmed',
    });
  });
  it('keeps SQL and thrown transport failures unconfirmed', async () => {
    setup({
      rpcError: {
        compare_save_personal_merchant_rulebook: { message: 'private SQL' },
      },
    });
    expect(await saveMerchantRulebook(input)).toEqual({
      status: 'unconfirmed',
    });
    mock.context.mockResolvedValue({
      dek: key,
      supabase: {
        rpc: () => {
          throw new Error('network');
        },
      },
    });
    expect(await saveMerchantRulebook(input)).toEqual({
      status: 'unconfirmed',
    });
  });
  it('reads only the current owner and decrypts the bounded validated envelope', async () => {
    const fake = setup({
      selectData: {
        id: input.id,
        revision: '9007199254740993',
        payload: encryptPayload(JSON.stringify(input.payload), key),
      },
    });
    expect(await getMerchantRulebook()).toEqual({
      id: input.id,
      revision: '9007199254740993',
      payload: input.payload,
    });
    expect(fake.calls.queries[0].eq).toEqual([
      { column: 'user_id', value: 'synthetic-owner' },
    ]);
    expect(fake.calls.queries[0].select).toContain('revision::text');
  });
  it('distinguishes absent book from read, decryption and schema failure', async () => {
    setup({ selectData: null });
    expect(await getMerchantRulebook()).toBeNull();
    for (const payload of [
      'bad-ciphertext',
      encryptPayload(
        JSON.stringify({ ...input.payload, schemaVersion: 2 }),
        key
      ),
      encryptPayload('x'.repeat(131073), key),
    ]) {
      setup({ selectData: { id: input.id, revision: '1', payload } });
      await expect(getMerchantRulebook()).rejects.toThrow(
        'Merchant rules could not be read'
      );
    }
    setup({ selectError: { message: 'private SQL' } });
    await expect(getMerchantRulebook()).rejects.toThrow();
  });
  it('never treats missing/unchanged/newer data as confirmation of a lost acknowledgement', () => {
    const saved = { id: input.id, revision: '1', payload: input.payload };
    expect(checkRulebookSave(input, saved)).toBe('saved');
    expect(checkRulebookSave(input, null)).toBe('unconfirmed');
    expect(checkRulebookSave({ ...input, expectedRevision: '1' }, saved)).toBe(
      'unconfirmed'
    );
    expect(checkRulebookSave(input, { ...saved, revision: '2' })).toBe(
      'conflict'
    );
    expect(
      checkRulebookSave(input, {
        ...saved,
        payload: { ...input.payload, rules: [] },
      })
    ).toBe('conflict');
    expect(
      checkRulebookSave(input, { ...saved, id: input.payload.requestId })
    ).toBe('conflict');
  });
});
