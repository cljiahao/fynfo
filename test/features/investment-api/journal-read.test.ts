import {
  generateJournalKeyPair,
  seal,
  wrapJournalPrivateKey,
} from '@/lib/sealed-box';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTableStub } from './stub-supabase';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CALLER_ID = '22222222-2222-4222-8222-222222222222';
const dek = crypto.randomBytes(32);
let stub: ReturnType<typeof makeTableStub>;

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({
    userId: USER_ID,
    dek,
    supabase: stub.client,
  }),
}));
vi.mock('@/integrations/services/invest-api-rpc', () => ({
  setJournalKey: vi.fn(),
}));

const { getJournalTimeline } =
  await import('@/features/investment-api/actions/journal-read');

function row(id: string, sealed: string) {
  return {
    id,
    caller_id: CALLER_ID,
    event_type: 'plan',
    occurred_at: '2026-11-27T10:00:00.123456+00:00',
    sealed,
  };
}

describe('getJournalTimeline', () => {
  let pair: ReturnType<typeof generateJournalKeyPair>;
  beforeEach(() => {
    pair = generateJournalKeyPair();
    stub = makeTableStub({
      invest_journal_keys: [
        { wrapped_private_key: wrapJournalPrivateKey(pair.privateKey, dek) },
      ],
      invest_api_callers: [{ id: CALLER_ID, name: 'ballast' }],
    });
  });

  it('opens events with the unwrapped journal key and nulls the ones that fail', async () => {
    const other = generateJournalKeyPair();
    stub.tables.invest_journal = [
      row(
        '33333333-3333-4333-8333-333333333333',
        seal(pair.publicKey, '{"ok":1}')
      ),
      row(
        '44444444-4444-4444-8444-444444444444',
        seal(other.publicKey, '{"ok":2}')
      ),
      row('55555555-5555-4555-8555-555555555555', 'garbage'),
    ];
    const events = await getJournalTimeline();
    expect(events.map((e) => e.payload)).toEqual(['{"ok":1}', null, null]);
    expect(events[0]).toMatchObject({ caller: 'ballast', eventType: 'plan' });
  });

  it('returns an empty list when there are no events', async () => {
    expect(await getJournalTimeline()).toEqual([]);
  });

  it('returns an empty list without creating a key when none exists', async () => {
    stub = makeTableStub({ invest_api_callers: [] });
    const { setJournalKey } =
      await import('@/integrations/services/invest-api-rpc');
    expect(await getJournalTimeline()).toEqual([]);
    expect(setJournalKey).not.toHaveBeenCalled();
  });
});
