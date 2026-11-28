import {
  addKey,
  appendJournal,
  authenticateKey,
  consumeNonce,
  createCaller,
  getJournalPublicKey,
  getSealedSummary,
  listJournalMeta,
  pruneInvestApi,
  publishSummary,
  revokeCaller,
  revokeKey,
  setCallerPublicKey,
  writeAudit,
} from '@/integrations/services/invest-api-rpc';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const rpc =
    vi.fn<
      (
        name: string,
        parameters?: Record<string, string | number | string[] | null>
      ) => Promise<{ data: unknown; error: unknown }>
    >();
  return { rpc, create: vi.fn(() => ({ rpc })) };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.create }));

const CALLER = '71111111-1111-4111-8111-111111111111';
const USER = '72222222-2222-4222-8222-222222222222';
const KEY = '73333333-3333-4333-8333-333333333333';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.invalid');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'fixture-secret-only');
  sdk.create.mockImplementation(() => ({ rpc: sdk.rpc }));
});

describe('invest-api-rpc', () => {
  it('maps an authenticated key row and returns null when none', async () => {
    sdk.rpc.mockResolvedValueOnce({
      data: [
        {
          caller_id: CALLER,
          user_id: USER,
          caller_name: 'ballast',
          public_key: 'pk',
          scopes: ['summary:read'],
        },
      ],
      error: null,
    });
    expect(await authenticateKey(KEY)).toEqual({
      callerId: CALLER,
      userId: USER,
      callerName: 'ballast',
      publicKey: 'pk',
      scopes: ['summary:read'],
    });
    expect(sdk.rpc).toHaveBeenCalledWith('invest_api_authenticate', {
      p_key_id: KEY,
    });
    sdk.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await authenticateKey(KEY)).toBeNull();
  });

  it('passes nonce, summary, journal and audit parameters through', async () => {
    const date = new Date('2026-11-28T00:00:00.000Z');
    sdk.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await consumeNonce('h'.repeat(64), date)).toBe(false);
    expect(sdk.rpc).toHaveBeenLastCalledWith('invest_api_consume_nonce', {
      p_hash: 'h'.repeat(64),
      p_expires_at: date.toISOString(),
    });

    sdk.rpc.mockResolvedValueOnce({
      data: [{ sealed: 's', published_at: '2026-11-28T00:00:00Z' }],
      error: null,
    });
    expect(await getSealedSummary(CALLER)).toEqual({
      sealed: 's',
      publishedAt: '2026-11-28T00:00:00Z',
    });
    sdk.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await getSealedSummary(CALLER)).toBeNull();

    sdk.rpc.mockResolvedValueOnce({ data: 'pub', error: null });
    expect(await getJournalPublicKey(CALLER)).toBe('pub');

    sdk.rpc.mockResolvedValueOnce({ data: KEY, error: null });
    expect(await appendJournal(CALLER, 'plan', date, 'sealed')).toBe(KEY);

    sdk.rpc.mockResolvedValueOnce({
      data: [
        { id: KEY, caller: 'ballast', event_type: 'plan', created_at: 'x' },
      ],
      error: null,
    });
    expect(await listJournalMeta(USER, null)).toHaveLength(1);
    expect(sdk.rpc).toHaveBeenLastCalledWith('invest_api_journal_meta', {
      p_user_id: USER,
      p_since_created_at: null,
      p_since_id: null,
    });
    sdk.rpc.mockResolvedValueOnce({ data: [], error: null });
    await listJournalMeta(USER, {
      createdAt: '2026-11-28T00:00:00.123456+00:00',
      id: KEY,
    });
    expect(sdk.rpc).toHaveBeenLastCalledWith('invest_api_journal_meta', {
      p_user_id: USER,
      p_since_created_at: '2026-11-28T00:00:00.123456+00:00',
      p_since_id: KEY,
    });

    sdk.rpc.mockResolvedValue({ data: null, error: null });
    await writeAudit(CALLER, KEY, '/api/v1/summary', 200);
    await publishSummary(USER, CALLER, 'sealed');
    await pruneInvestApi();
    expect(sdk.rpc).toHaveBeenCalledWith('invest_api_audit_write', {
      p_caller_id: CALLER,
      p_key_id: KEY,
      p_endpoint: '/api/v1/summary',
      p_status: 200,
    });
  });

  it('fails opaquely on RPC errors, bad shapes and missing configuration', async () => {
    sdk.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'relation "invest_api_keys" does not exist' },
    });
    await expect(authenticateKey(KEY)).rejects.toThrow(
      'Investment API service unavailable'
    );
    sdk.rpc.mockResolvedValueOnce({ data: [{ nope: 1 }], error: null });
    await expect(authenticateKey(KEY)).rejects.toThrow(
      'Investment API service unavailable'
    );
    sdk.rpc.mockRejectedValueOnce(new Error('network down at 10.0.0.1'));
    await expect(authenticateKey(KEY)).rejects.toThrow(
      'Investment API service unavailable'
    );
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    await expect(pruneInvestApi()).rejects.toThrow(
      'Investment API service unavailable'
    );
  });

  it('rejects an out-of-range audit status before calling the RPC', async () => {
    for (const status of [99, 600, 200.5, Number.NaN]) {
      await expect(
        writeAudit(CALLER, KEY, '/api/v1/summary', status)
      ).rejects.toThrow('Investment API service unavailable');
    }
    expect(sdk.rpc).not.toHaveBeenCalled();
  });

  it('wraps the caller management RPCs', async () => {
    sdk.rpc.mockResolvedValueOnce({ data: CALLER, error: null });
    expect(await createCaller(USER, 'ballast', ['summary:read'], 'pk')).toBe(
      CALLER
    );
    expect(sdk.rpc).toHaveBeenLastCalledWith('invest_api_create_caller', {
      p_user_id: USER,
      p_name: 'ballast',
      p_scopes: ['summary:read'],
      p_caller_public_key: 'pk',
    });

    sdk.rpc.mockResolvedValueOnce({
      data: [{ key_id: KEY, expires_at: '2027-02-26T00:00:00Z' }],
      error: null,
    });
    expect(await addKey(USER, CALLER, 'spk')).toEqual({
      keyId: KEY,
      expiresAt: '2027-02-26T00:00:00Z',
    });
    expect(sdk.rpc).toHaveBeenLastCalledWith('invest_api_add_key', {
      p_user_id: USER,
      p_caller_id: CALLER,
      p_signing_public_key: 'spk',
    });
    sdk.rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(addKey(USER, CALLER, 'spk')).rejects.toThrow(
      'Investment API service unavailable'
    );

    sdk.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await revokeKey(USER, KEY)).toBe(true);
    expect(sdk.rpc).toHaveBeenLastCalledWith('invest_api_revoke_key', {
      p_user_id: USER,
      p_key_id: KEY,
    });
    sdk.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await revokeCaller(USER, CALLER)).toBe(false);
    expect(sdk.rpc).toHaveBeenLastCalledWith('invest_api_revoke_caller', {
      p_user_id: USER,
      p_caller_id: CALLER,
    });
    sdk.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await setCallerPublicKey(USER, CALLER, 'pk2')).toBe(true);
    expect(sdk.rpc).toHaveBeenLastCalledWith(
      'invest_api_set_caller_public_key',
      {
        p_user_id: USER,
        p_caller_id: CALLER,
        p_key: 'pk2',
      }
    );

    sdk.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'caller already has two active keys' },
    });
    await expect(addKey(USER, CALLER, 'spk')).rejects.toThrow(
      'Investment API service unavailable'
    );
  });
});
