import {
  generateJournalKeyPair,
  open,
  unwrapJournalPrivateKey,
} from '@/lib/sealed-box';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTableStub } from './stub-supabase';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const dek = crypto.randomBytes(32);

let stub: ReturnType<typeof makeTableStub>;
const publishSummary = vi.fn();
const setJournalKey = vi.fn();

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({
    userId: USER_ID,
    dek,
    supabase: stub.client,
  }),
}));
vi.mock('@/integrations/services/invest-api-rpc', () => ({
  publishSummary: (...args: unknown[]) => publishSummary(...args),
  setJournalKey: (...args: unknown[]) => setJournalKey(...args),
}));

const { setWeeklyBudget, getWeeklyBudget } =
  await import('@/features/investment-api/actions/publish-budget');
const { publishInvestmentSummary } =
  await import('@/features/investment-api/actions/publish-summary');
const { ensureJournalPrivateKey } =
  await import('@/features/investment-api/actions/journal-keys');

function caller(overrides: Record<string, unknown> = {}) {
  const pair = generateJournalKeyPair();
  return {
    pair,
    row: {
      id: crypto.randomUUID(),
      x25519_public_key: pair.publicKey.toString('base64'),
      scopes: ['summary:read'],
      revoked_at: null,
      ...overrides,
    },
  };
}

function seedBudget(weeklyBudget: number) {
  return setWeeklyBudget({ weeklyBudget });
}

beforeEach(() => {
  publishSummary.mockReset();
  setJournalKey.mockReset();
  stub = makeTableStub({});
  // Mimics the RPC: create only when the user has no row.
  setJournalKey.mockImplementation(
    async (_user: string, pub: string, wrapped: string) => {
      if ((stub.tables.invest_journal_keys ?? []).length > 0) return false;
      stub.tables.invest_journal_keys = [
        { public_key: pub, wrapped_private_key: wrapped },
      ];
      return true;
    }
  );
});

describe('weekly budget', () => {
  it('round-trips encrypted and never stores the number in plaintext', async () => {
    await seedBudget(300);
    const stored = stub.upserts[0]?.payload as { payload: string };
    expect(stored.payload).not.toContain('300');
    expect(stored.payload).not.toContain('weekly_budget');
    expect(await getWeeklyBudget()).toBe(300);
  });

  it('is null before it is set', async () => {
    expect(await getWeeklyBudget()).toBeNull();
  });

  it.each([-1, Number.NaN, Infinity, 2e9, '300', null])(
    'rejects %s',
    async (bad) => {
      await expect(setWeeklyBudget({ weeklyBudget: bad })).rejects.toThrow();
      expect(stub.upserts).toHaveLength(0);
    }
  );

  it('rejects unknown fields', async () => {
    await expect(
      setWeeklyBudget({ weeklyBudget: 1, userId: 'x' })
    ).rejects.toThrow();
  });

  it('treats a tampered stored payload as unavailable', async () => {
    stub.tables.invest_settings = [{ payload: 'not-ciphertext' }];
    await expect(getWeeklyBudget()).rejects.toThrow();
  });
});

describe('publishInvestmentSummary', () => {
  it('seals once per eligible caller and skips revoked or unscoped ones', async () => {
    const a = caller();
    const b = caller();
    const revoked = caller({ revoked_at: '2026-11-01T00:00:00Z' });
    const noScope = caller({ scopes: ['journal:append:plan'] });
    stub.tables.invest_api_callers = [a.row, b.row, revoked.row, noScope.row];
    await seedBudget(250);

    const result = await publishInvestmentSummary({ surplus: 1234.56 });

    expect(result).toEqual({ published: 2 });
    expect(publishSummary).toHaveBeenCalledTimes(2);
    const ids = publishSummary.mock.calls.map((c) => c[1]);
    expect(ids).toEqual([a.row.id, b.row.id]);
    for (const [user, callerId, sealed] of publishSummary.mock.calls) {
      expect(user).toBe(USER_ID);
      const target = callerId === a.row.id ? a : b;
      const opened = JSON.parse(
        open(target.pair.privateKey, sealed as string).toString('utf8')
      );
      expect(opened).toEqual({
        surplus: 1234.56,
        weekly_budget: 250,
        currency: 'SGD',
        as_of: new Date().toISOString().slice(0, 10),
      });
    }
  });

  it('publishes nothing without a weekly budget', async () => {
    stub.tables.invest_api_callers = [caller().row];
    expect(await publishInvestmentSummary({ surplus: 5 })).toEqual({
      published: 0,
    });
    expect(publishSummary).not.toHaveBeenCalled();
  });

  it.each([
    { surplus: Number.NaN },
    { surplus: '5' },
    {},
    { surplus: 1, userId: 'x' },
  ])('rejects invalid input %j', async (bad) => {
    await seedBudget(10);
    await expect(publishInvestmentSummary(bad)).rejects.toThrow();
    expect(publishSummary).not.toHaveBeenCalled();
  });

  it('creates the journal keypair on first publish', async () => {
    await publishInvestmentSummary({ surplus: 1 });
    expect(setJournalKey).toHaveBeenCalledTimes(1);
  });
});

describe('journal keypair', () => {
  it('is created once and unwraps to the same key on later calls', async () => {
    const first = await ensureJournalPrivateKey(
      stub.client as never,
      USER_ID,
      dek
    );
    const second = await ensureJournalPrivateKey(
      stub.client as never,
      USER_ID,
      dek
    );
    expect(setJournalKey).toHaveBeenCalledTimes(1);
    expect(second.equals(first)).toBe(true);
    const row = stub.tables.invest_journal_keys?.[0] as {
      wrapped_private_key: string;
    };
    expect(
      unwrapJournalPrivateKey(row.wrapped_private_key, dek).equals(first)
    ).toBe(true);
  });

  it('cannot be unwrapped under a different DEK', async () => {
    await ensureJournalPrivateKey(stub.client as never, USER_ID, dek);
    await expect(
      ensureJournalPrivateKey(
        stub.client as never,
        USER_ID,
        crypto.randomBytes(32)
      )
    ).rejects.toThrow();
  });
});
