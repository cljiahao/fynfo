import {
  finishVaultUnlock,
  readMarketingAggregates,
  recordMarketingEvent,
  reserveVaultUnlock,
} from '@/integrations/services/security-rpc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ClientOptions {
  auth: {
    persistSession: boolean;
    autoRefreshToken: boolean;
    detectSessionInUrl: boolean;
  };
  global: { fetch: typeof fetch };
}
const sdk = vi.hoisted(() => {
  const rpc =
    vi.fn<
      (
        name: string,
        parameters?: Record<string, string | boolean>
      ) => Promise<{ data: unknown; error: unknown }>
    >();
  return {
    rpc,
    create: vi.fn((_url: string, _key: string, _options: ClientOptions) => ({
      rpc,
    })),
  };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.create }));
const USER = '71111111-1111-4111-8111-111111111111';
const ATTEMPT = '72222222-2222-4222-8222-222222222222';
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.invalid');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'fixture-secret-only');
  sdk.create.mockImplementation(() => ({ rpc: sdk.rpc }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('trusted security RPC facade', () => {
  it.each(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY'])(
    'fails before SDK creation when %s is missing',
    async (name) => {
      vi.stubEnv(name, '');
      await expect(reserveVaultUnlock(USER)).rejects.toThrow(
        'Security service unavailable'
      );
      expect(sdk.create).not.toHaveBeenCalled();
      expect(sdk.rpc).not.toHaveBeenCalled();
    }
  );
  it.each(['error reply', 'SDK throw', 'client construction throw'])(
    'returns an opaque error after %s without exposing service details',
    async (failure) => {
      if (failure === 'error reply')
        sdk.rpc.mockResolvedValue({
          data: ATTEMPT,
          error: { message: 'fixture-secret-only database internal' },
        });
      else if (failure === 'SDK throw')
        sdk.rpc.mockRejectedValue(
          new Error('fixture-secret-only database internal')
        );
      else
        sdk.create.mockImplementation(() => {
          throw new Error('fixture-secret-only SDK internal');
        });
      await expect(reserveVaultUnlock(USER)).rejects.toThrow(
        /^Security service unavailable$/
      );
    }
  );
  it('disables session persistence, refresh and URL auth parsing on the privileged SDK client', async () => {
    sdk.rpc.mockResolvedValue({ data: ATTEMPT, error: null });
    expect(await reserveVaultUnlock(USER)).toBe(ATTEMPT);
    expect(sdk.create.mock.calls[0].slice(0, 2)).toEqual([
      'https://fixture.invalid',
      'fixture-secret-only',
    ]);
    expect(sdk.create.mock.calls[0][2].auth).toEqual({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
    expect(sdk.rpc).toHaveBeenCalledWith('reserve_vault_unlock', {
      p_user_id: USER,
    });
  });
  it('distinguishes a denied reservation from a usable proof token', async () => {
    sdk.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: ATTEMPT, error: null });
    expect(await reserveVaultUnlock(USER)).toBeNull();
    expect(await reserveVaultUnlock(USER)).toBe(ATTEMPT);
  });
  it.each(['', 'not-a-uuid', false, 0, {}, undefined])(
    'rejects malformed reservation replies',
    async (data) => {
      sdk.rpc.mockResolvedValue({ data, error: null });
      await expect(reserveVaultUnlock(USER)).rejects.toThrow(
        /^Security service unavailable$/
      );
    }
  );
  it.each([true, false])(
    'finishes the exact reservation with success=%s and returns the locked state',
    async (success) => {
      sdk.rpc.mockResolvedValue({ data: !success, error: null });
      expect(await finishVaultUnlock(USER, ATTEMPT, success)).toBe(!success);
      expect(sdk.rpc).toHaveBeenCalledWith('finish_vault_unlock', {
        p_user_id: USER,
        p_attempt_id: ATTEMPT,
        p_success: success,
      });
    }
  );
  it.each([true, false])(
    'rejects malformed finish results for success=%s',
    async (success) => {
      for (const data of [null, 0, 'false', {}, undefined]) {
        sdk.rpc.mockResolvedValue({ data, error: null });
        await expect(finishVaultUnlock(USER, ATTEMPT, success)).rejects.toThrow(
          /^Security service unavailable$/
        );
      }
    }
  );
  it('only forwards validated telemetry event/path data to the ingestion RPC', async () => {
    sdk.rpc.mockResolvedValue({ data: null, error: null });
    await recordMarketingEvent('cta_click', '/login');
    expect(sdk.rpc).toHaveBeenCalledWith('record_marketing_event', {
      p_event_type: 'cta_click',
      p_path: '/login',
    });
    expect(sdk.rpc).toHaveBeenCalledOnce();
  });
  it('reads both aggregate RPCs and normalizes numeric Postgres bigint strings', async () => {
    sdk.rpc.mockImplementation(async (name) => ({
      data:
        name === 'get_marketing_event_stats'
          ? [{ day: '2026-10-08', event_type: 'page_view', events: '17' }]
          : [{ day: '2026-10-08', signups: '3' }],
      error: null,
    }));
    expect(await readMarketingAggregates()).toEqual({
      events: [{ day: '2026-10-08', event_type: 'page_view', events: 17 }],
      signups: [{ day: '2026-10-08', signups: 3 }],
    });
    expect(sdk.rpc).toHaveBeenCalledWith(
      'get_marketing_event_stats',
      undefined
    );
    expect(sdk.rpc).toHaveBeenCalledWith('get_signup_stats', undefined);
  });
  it.each(['events', 'signups'])(
    'fails the whole aggregate read when %s replies are malformed',
    async (domain) => {
      sdk.rpc.mockImplementation(async (name) => ({
        data:
          name ===
          (domain === 'events'
            ? 'get_marketing_event_stats'
            : 'get_signup_stats')
            ? [
                {
                  day: '2026-10-08',
                  event_type: 'page_view',
                  events: -1,
                  signups: 1.5,
                },
              ]
            : [],
        error: null,
      }));
      await expect(readMarketingAggregates()).rejects.toThrow(
        /^Security service unavailable$/
      );
    }
  );
  it.each([null, false, '', [], true, {}, '1.5', '9007199254740992'])(
    'rejects malformed scalar counts instead of silently coercing them',
    async (count) => {
      for (const domain of ['events', 'signups']) {
        sdk.rpc.mockImplementation(async (name) => ({
          data:
            name ===
            (domain === 'events'
              ? 'get_marketing_event_stats'
              : 'get_signup_stats')
              ? [
                  {
                    day: '2026-10-08',
                    event_type: 'page_view',
                    events: count,
                    signups: count,
                  },
                ]
              : [],
          error: null,
        }));
        await expect(readMarketingAggregates()).rejects.toThrow(
          /^Security service unavailable$/
        );
      }
    }
  );
  it('adds a ten-second deadline and retains caller cancellation and request body', async () => {
    sdk.rpc.mockResolvedValue({ data: ATTEMPT, error: null });
    await reserveVaultUnlock(USER);
    const timed = new AbortController();
    const caller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timed.signal);
    const network = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', network);
    const boundedFetch = sdk.create.mock.calls[0][2].global.fetch;
    await boundedFetch('https://fixture.invalid/rpc', {
      method: 'POST',
      body: 'fixture',
      signal: caller.signal,
    });
    expect(timeout).toHaveBeenCalledWith(10000);
    const sent = network.mock.calls[0][1]!;
    expect(sent.method).toBe('POST');
    expect(sent.body).toBe('fixture');
    expect(sent.signal?.aborted).toBe(false);
    caller.abort();
    expect(sent.signal?.aborted).toBe(true);
    await boundedFetch('https://fixture.invalid/rpc');
    timed.abort();
    expect(network.mock.calls[1][1]?.signal?.aborted).toBe(true);
  });
});
