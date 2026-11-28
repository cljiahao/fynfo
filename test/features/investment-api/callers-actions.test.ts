import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const requireUserId = vi.fn(async () => {
  calls.push('requireUserId');
  return 'user-1';
});
const getVaultDekSession = vi.fn(async (): Promise<Buffer | null> => {
  calls.push('getVaultDekSession');
  return Buffer.alloc(32);
});
const rpc = {
  createCaller: vi.fn(),
  addKey: vi.fn(),
  revokeKey: vi.fn(),
  revokeCaller: vi.fn(),
  setCallerPublicKey: vi.fn(),
};
const tableRows: Record<string, unknown[]> = {};
const fromTable = vi.fn((table: string) => {
  calls.push(`db:${table}`);
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'limit', 'order']) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: tableRows[table] ?? [], error: null });
  return chain;
});

vi.mock('@/lib/auth-guard', () => ({ requireUserId: () => requireUserId() }));
vi.mock('@/lib/keystore', () => ({
  getVaultDekSession: () => getVaultDekSession(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: async () => ({ from: fromTable }),
}));
vi.mock('@/integrations/services/invest-api-rpc', () => rpc);

const KEY_A = 'A'.repeat(43) + '=';
const KEY_B = 'B'.repeat(43) + '=';
const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const KEY_ID = '22222222-2222-4222-8222-222222222222';

async function actions() {
  return import('@/features/investment-api/actions/callers-actions');
}

beforeEach(() => {
  calls.length = 0;
  for (const key of Object.keys(tableRows)) delete tableRows[key];
  vi.clearAllMocks();
  getVaultDekSession.mockImplementation(async () => {
    calls.push('getVaultDekSession');
    return Buffer.alloc(32);
  });
  rpc.createCaller.mockResolvedValue(CALLER_ID);
  rpc.addKey.mockResolvedValue({ keyId: KEY_ID, expiresAt: '2027-03-01' });
  rpc.revokeKey.mockResolvedValue(true);
  rpc.revokeCaller.mockResolvedValue(true);
  rpc.setCallerPublicKey.mockResolvedValue(true);
});

describe('investment api caller actions', () => {
  it('calls requireUserId then getVaultDekSession before any DB access', async () => {
    const { listCallers } = await actions();
    await listCallers();
    expect(calls.slice(0, 3)).toEqual([
      'requireUserId',
      'getVaultDekSession',
      'db:invest_api_callers',
    ]);
  });

  it('rejects when the vault is locked and touches nothing', async () => {
    getVaultDekSession.mockResolvedValueOnce(null);
    const { createCallerAction } = await actions();
    await expect(
      createCallerAction({
        name: 'ballast',
        preset: 'ballast',
        signingPublicKey: KEY_A,
        sealingPublicKey: KEY_B,
      })
    ).rejects.toThrow(/locked/i);
    expect(fromTable).not.toHaveBeenCalled();
    expect(rpc.createCaller).not.toHaveBeenCalled();
  });

  it.each([
    ['atlas', ['summary:read', 'journal:meta']],
    [
      'ballast',
      ['summary:read', 'journal:append:plan', 'journal:append:sell_flag'],
    ],
    ['acciaux', ['journal:append:verdict']],
  ])('creates a %s caller with its preset scopes', async (preset, scopes) => {
    const { createCallerAction } = await actions();
    const result = await createCallerAction({
      name: preset,
      preset,
      signingPublicKey: KEY_A,
      sealingPublicKey: KEY_B,
    });
    expect(result).toEqual({ ok: true, callerId: CALLER_ID, keyId: KEY_ID });
    expect(rpc.createCaller).toHaveBeenCalledWith(
      'user-1',
      preset,
      scopes,
      KEY_B
    );
    expect(rpc.addKey).toHaveBeenCalledWith('user-1', CALLER_ID, KEY_A);
  });

  it('rejects free-form presets and malformed keys', async () => {
    const { createCallerAction } = await actions();
    const base = {
      name: 'ballast',
      preset: 'ballast',
      signingPublicKey: KEY_A,
      sealingPublicKey: KEY_B,
    };
    for (const bad of [
      { ...base, preset: 'admin' },
      { ...base, signingPublicKey: 'short' },
      { ...base, sealingPublicKey: 'A'.repeat(44) },
      { ...base, name: '' },
    ]) {
      expect((await createCallerAction(bad)).ok).toBe(false);
    }
    expect(rpc.createCaller).not.toHaveBeenCalled();
  });

  it('returns a specific message for a duplicate caller name', async () => {
    tableRows.invest_api_callers = [{ id: CALLER_ID }];
    const { createCallerAction } = await actions();
    const result = await createCallerAction({
      name: 'ballast',
      preset: 'ballast',
      signingPublicKey: KEY_A,
      sealingPublicKey: KEY_B,
    });
    expect(result).toEqual({
      ok: false,
      message: 'That caller name is already used.',
    });
    expect(rpc.createCaller).not.toHaveBeenCalled();
  });

  it('returns a partial result when addKey fails after the caller is created', async () => {
    rpc.addKey.mockRejectedValueOnce(new Error('pg: trigger detail'));
    const { createCallerAction } = await actions();
    const result = await createCallerAction({
      name: 'ballast',
      preset: 'ballast',
      signingPublicKey: KEY_A,
      sealingPublicKey: KEY_B,
    });
    expect(result).toEqual({
      ok: false,
      partial: true,
      callerId: CALLER_ID,
      message: 'Caller created; add a signing key from the list.',
    });
    expect(rpc.createCaller).toHaveBeenCalledTimes(1);
  });

  it('maps wrapper failures to a generic message', async () => {
    rpc.createCaller.mockRejectedValueOnce(new Error('pg: secret detail'));
    const { createCallerAction } = await actions();
    const result = await createCallerAction({
      name: 'ballast',
      preset: 'ballast',
      signingPublicKey: KEY_A,
      sealingPublicKey: KEY_B,
    });
    expect(result).toEqual({
      ok: false,
      message: 'Something went wrong. Please try again.',
    });
  });

  it('adds a key and returns the keyId', async () => {
    tableRows.invest_api_keys = [
      {
        id: 'k1',
        created_at: '2026-01-01',
        expires_at: '2999-01-01',
        revoked_at: null,
      },
    ];
    const { addKeyAction } = await actions();
    const result = await addKeyAction({
      callerId: CALLER_ID,
      signingPublicKey: KEY_B,
    });
    expect(result).toEqual({
      ok: true,
      keyId: KEY_ID,
      expiresAt: '2027-03-01',
    });
    expect(rpc.addKey).toHaveBeenCalledWith('user-1', CALLER_ID, KEY_B);
  });

  it('blocks a third active key but ignores revoked and expired ones', async () => {
    const active = (id: string) => ({
      id,
      created_at: '2026-01-01',
      expires_at: '2999-01-01',
      revoked_at: null,
    });
    tableRows.invest_api_keys = [
      active('k1'),
      active('k2'),
      { ...active('k3'), revoked_at: '2026-02-01' },
    ];
    const { addKeyAction } = await actions();
    const blocked = await addKeyAction({
      callerId: CALLER_ID,
      signingPublicKey: KEY_B,
    });
    expect(blocked.ok).toBe(false);
    expect(rpc.addKey).not.toHaveBeenCalled();

    tableRows.invest_api_keys = [
      active('k1'),
      { ...active('k2'), expires_at: '2000-01-01' },
    ];
    const allowed = await addKeyAction({
      callerId: CALLER_ID,
      signingPublicKey: KEY_B,
    });
    expect(allowed.ok).toBe(true);
  });

  it('revokes a key and reports an unknown key', async () => {
    const { revokeKeyAction } = await actions();
    expect(await revokeKeyAction({ keyId: KEY_ID })).toEqual({ ok: true });
    expect(rpc.revokeKey).toHaveBeenCalledWith('user-1', KEY_ID);
    rpc.revokeKey.mockResolvedValueOnce(false);
    expect((await revokeKeyAction({ keyId: KEY_ID })).ok).toBe(false);
  });

  it('revokes a caller', async () => {
    const { revokeCallerAction } = await actions();
    expect(await revokeCallerAction({ callerId: CALLER_ID })).toEqual({
      ok: true,
    });
    expect(rpc.revokeCaller).toHaveBeenCalledWith('user-1', CALLER_ID);
  });

  it('changes the sealing key and rejects a malformed one', async () => {
    const { setSealingKeyAction } = await actions();
    expect(
      await setSealingKeyAction({
        callerId: CALLER_ID,
        sealingPublicKey: KEY_B,
      })
    ).toEqual({ ok: true });
    expect(rpc.setCallerPublicKey).toHaveBeenCalledWith(
      'user-1',
      CALLER_ID,
      KEY_B
    );
    const bad = await setSealingKeyAction({
      callerId: CALLER_ID,
      sealingPublicKey: 'nope',
    });
    expect(bad.ok).toBe(false);
    expect(rpc.setCallerPublicKey).toHaveBeenCalledTimes(1);
  });

  it('lists callers with preset, fingerprint and sorted keys', async () => {
    tableRows.invest_api_callers = [
      {
        id: CALLER_ID,
        name: 'ballast',
        scopes: [
          'journal:append:sell_flag',
          'journal:append:plan',
          'summary:read',
        ],
        x25519_public_key: KEY_B,
        created_at: '2026-01-01',
        revoked_at: null,
        invest_api_keys: [
          {
            id: 'k2',
            created_at: '2026-02-01',
            expires_at: '2999-01-01',
            revoked_at: null,
          },
          {
            id: 'k1',
            created_at: '2026-01-01',
            expires_at: '2999-01-01',
            revoked_at: null,
          },
        ],
      },
    ];
    const { listCallers } = await actions();
    const [caller] = await listCallers();
    expect(caller?.preset).toBe('ballast');
    expect(caller?.sealingFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(caller?.keys.map((k) => k.id)).toEqual(['k1', 'k2']);
  });
});
