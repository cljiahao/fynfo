import {
  appendJournal,
  authenticateKey,
  consumeNonce,
  getJournalPublicKey,
  getSealedSummary,
  listJournalMeta,
  pruneInvestApi,
  publishSummary,
  writeAudit,
} from '@/integrations/services/invest-api-rpc';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const rpc =
    vi.fn<
      (
        name: string,
        parameters?: Record<string, string | number | null>
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
      p_since: null,
    });
    sdk.rpc.mockResolvedValueOnce({ data: [], error: null });
    await listJournalMeta(USER, date);
    expect(sdk.rpc).toHaveBeenLastCalledWith('invest_api_journal_meta', {
      p_user_id: USER,
      p_since: date.toISOString(),
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
});
