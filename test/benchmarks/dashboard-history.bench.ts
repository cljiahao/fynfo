import { getSnapshots } from '@/features/assets/actions/snapshot-actions';
import { encryptPayload } from '@/lib/crypto';
import { bench, describe, vi } from 'vitest';
import { makeFakeSupabase } from '../helpers/fake-supabase';

const KEY = Buffer.alloc(32, 7);
const MONTH_COUNTS = [12, 120, 1200];
const ENTRIES_PER_MONTH = 6;
const API_CAP = 125;
let supabase: ReturnType<typeof makeFakeSupabase>['client'];

vi.mock('@/lib/action-guard', () => ({
  requireActionContext: async () => ({
    userId: 'synthetic-owner',
    dek: KEY,
    supabase,
  }),
}));

const account = encryptPayload('Synthetic account', KEY);
const amount = encryptPayload('100', KEY);
const fixtures = MONTH_COUNTS.map((months) => ({
  months,
  parents: Array.from({ length: months }, (_, index) => ({
    id: `snapshot-${index}`,
    month: `${2000 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
    revision: '1',
  })),
  children: Array.from({ length: months * ENTRIES_PER_MONTH }, (_, index) => ({
    id: `entry-${index}`,
    snapshot_id: `snapshot-${Math.floor(index / ENTRIES_PER_MONTH)}`,
    category: 'savings',
    account,
    amount,
  })),
}));

describe('synthetic full snapshot history: local query orchestration and AES-GCM', () => {
  for (const fixture of fixtures) {
    bench(
      `${fixture.months} months / ${fixture.children.length} entries / cap${API_CAP}`,
      async () => {
        const fake = makeFakeSupabase({
          apiMaxRows: API_CAP,
          selectDataByTable: {
            monthly_snapshots: fixture.parents,
            asset_entries: fixture.children,
          },
        });
        supabase = fake.client;
        const result = await getSnapshots();
        const expectedPages =
          Math.ceil(fixture.months / API_CAP) +
          Math.ceil(fixture.children.length / API_CAP);
        if (
          result.length !== fixture.months ||
          result.some(
            (snapshot) =>
              snapshot.entries.length !== ENTRIES_PER_MONTH ||
              snapshot.entries.some(
                (entry) =>
                  entry.amount !== 100 || entry.account !== 'Synthetic account'
              )
          ) ||
          fake.calls.queries.length !== expectedPages
        ) {
          throw new Error('Synthetic benchmark completeness contract failed');
        }
      },
      { time: 500, iterations: 20, warmupTime: 100 }
    );
  }
});
