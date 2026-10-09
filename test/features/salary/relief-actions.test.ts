import * as fieldCrypto from '@/lib/crypto';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeFakeSupabase,
  type FakeSupabaseOptions,
} from '../../helpers/fake-supabase';

const USER_ID = 'user-1';
const DEK = Buffer.alloc(32, 4);

let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({ userId: USER_ID, dek: DEK, supabase }),
  requireDbContext: async () => ({ userId: USER_ID, supabase }),
}));

function setSupabase(opts: FakeSupabaseOptions = {}) {
  const fake = makeFakeSupabase(opts);
  supabase = fake.client;
  return fake;
}

beforeEach(() => {
  vi.restoreAllMocks();
  setSupabase();
});

describe('relief-actions — getAllTaxReliefs', () => {
  it('decrypts amount and carries the year across all years', async () => {
    setSupabase({
      selectData: [
        {
          year: 2025,
          relief_key: 'cpf',
          amount: await encryptPayload('1000', DEK),
        },
        {
          year: 2026,
          relief_key: 'srs',
          amount: await encryptPayload('500', DEK),
        },
      ],
    });
    const { getAllTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    expect(await getAllTaxReliefs()).toEqual([
      { year: 2025, reliefKey: 'cpf', amount: 1000 },
      { year: 2026, reliefKey: 'srs', amount: 500 },
    ]);
  });

  it('returns [] when there are no rows', async () => {
    setSupabase({ selectData: [] });
    const { getAllTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    expect(await getAllTaxReliefs()).toEqual([]);
  });

  it('surfaces an opaque error on a read failure', async () => {
    setSupabase({
      selectError: { message: 'permission denied on tax_relief_entries' },
    });
    const { getAllTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    await expect(getAllTaxReliefs()).rejects.toThrow('tax_relief read failed');
  });
});

describe('relief-actions — getTaxReliefs', () => {
  it('returns an empty list for a year with no reliefs', async () => {
    setSupabase({ selectData: [] });
    const { getTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    expect(await getTaxReliefs(2026)).toEqual([]);
  });
  it('decrypts amount for a single year', async () => {
    setSupabase({
      selectData: [
        { relief_key: 'cpf', amount: await encryptPayload('1200', DEK) },
      ],
    });
    const { getTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    expect(await getTaxReliefs(2026)).toEqual([
      { reliefKey: 'cpf', amount: 1200 },
    ]);
  });

  it('surfaces an opaque error on a read failure', async () => {
    setSupabase({ selectError: { message: 'permission denied' } });
    const { getTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    await expect(getTaxReliefs(2026)).rejects.toThrow('tax_relief read failed');
  });
});

describe('relief-actions — upsertTaxReliefs', () => {
  const reliefs = [
    { reliefKey: 'cpf', amount: 1000 },
    { reliefKey: 'srs', amount: 500 },
  ];

  it('prepares every replacement before any deletion, even when later encryption fails', async () => {
    const fake = setSupabase();
    const encrypt = fieldCrypto.encryptPayload;
    vi.spyOn(fieldCrypto, 'encryptPayload').mockImplementation((text, key) => {
      if (text === '500') throw new Error('synthetic encryption failure');
      return encrypt(text, key);
    });
    const { upsertTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    await expect(upsertTaxReliefs(2026, reliefs)).rejects.toThrow(
      'synthetic encryption failure'
    );
    expect(fake.calls.from).toHaveLength(0);
    expect(fake.calls.delete).toBe(0);
    expect(fake.calls.insert).toHaveLength(0);
  });

  it('rejects duplicate relief keys before any database access', async () => {
    const fake = setSupabase();
    const { upsertTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    await expect(
      upsertTaxReliefs(2026, [reliefs[0], { ...reliefs[0], amount: 500 }])
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.calls.from).toHaveLength(0);
  });

  it('encrypts the whole year in one RPC without ownership or year on children', async () => {
    const fake = setSupabase();
    const { upsertTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    await upsertTaxReliefs(2026, reliefs);
    expect(fake.calls.from).toEqual([]);
    expect(fake.calls.rpc).toHaveLength(1);
    const { name } = fake.calls.rpc[0];
    const args = fake.calls.rpc[0].args as Record<string, unknown>;
    expect(name).toBe('replace_tax_relief_year');
    expect(args.p_year).toBe(2026);
    const rows = args.p_reliefs as Array<Record<string, string>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toHaveProperty('user_id');
    expect(rows[0]).not.toHaveProperty('year');
    expect(rows[0].relief_key).toBe('cpf');
    expect(await decryptPayload(rows[0].amount, DEK)).toBe('1000');
  });
  it('clears an empty year through the RPC', async () => {
    const fake = setSupabase();
    const { upsertTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    await upsertTaxReliefs(2026, []);
    expect(fake.calls.rpc[0].args).toEqual({ p_year: 2026, p_reliefs: [] });
    expect(fake.calls.from).toEqual([]);
  });
  it('rejects invalid year and relief before database access', async () => {
    const fake = setSupabase();
    const { upsertTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    await expect(upsertTaxReliefs(0, reliefs)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(
      upsertTaxReliefs(2026, [{ reliefKey: '', amount: -1 }])
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.calls.rpc).toEqual([]);
    expect(fake.calls.from).toEqual([]);
  });
  it('fails closed with an opaque RPC error', async () => {
    const fake = setSupabase({
      rpcError: {
        replace_tax_relief_year: { message: 'private constraint details' },
      },
    });
    const { upsertTaxReliefs } =
      await import('@/features/salary/actions/relief-actions');
    await expect(upsertTaxReliefs(2026, reliefs)).rejects.toThrow(
      'tax_relief save failed'
    );
    expect(fake.calls.from).toEqual([]);
  });
});
