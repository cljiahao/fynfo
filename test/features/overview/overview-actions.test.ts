import { getOverviewReads } from '@/features/overview/actions/overview-actions';
import { beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getUser: vi.fn(),
  getDek: vi.fn(),
  getSnapshots: vi.fn(),
  getSalaryRecords: vi.fn(),
  getPlannerSettings: vi.fn(),
  getExpenses: vi.fn(),
  getTrades: vi.fn(),
}));
vi.mock('@/integrations/services/supabase', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: api.getUser } }),
}));
vi.mock('@/lib/keystore', () => ({ getVaultDekSession: api.getDek }));
vi.mock('@/features/assets', () => ({
  getSnapshots: api.getSnapshots,
  getPlannerSettings: api.getPlannerSettings,
}));
vi.mock('@/features/salary', () => ({
  getSalaryRecords: api.getSalaryRecords,
}));
vi.mock('@/features/expenses', () => ({ getExpenses: api.getExpenses }));
vi.mock('@/features/equity', () => ({ getTrades: api.getTrades }));
const readers = [
  api.getSnapshots,
  api.getSalaryRecords,
  api.getPlannerSettings,
  api.getExpenses,
  api.getTrades,
];
beforeEach(() => {
  vi.clearAllMocks();
  api.getUser.mockResolvedValue({
    data: { user: { id: 'synthetic-owner' } },
    error: null,
  });
  api.getDek.mockResolvedValue(Buffer.alloc(32, 1));
  for (const read of readers) read.mockResolvedValue([]);
});

it.each(['auth', 'vault'])(
  'launches no reader when the %s guard fails',
  async (kind) => {
    if (kind === 'auth')
      api.getUser.mockResolvedValue({ data: { user: null }, error: null });
    else api.getDek.mockResolvedValue(null);
    await expect(getOverviewReads(['snapshots', 'salary'])).rejects.toThrow();
    for (const read of readers) expect(read).not.toHaveBeenCalled();
    if (kind === 'auth') expect(api.getDek).not.toHaveBeenCalled();
    else expect(api.getDek).toHaveBeenCalledWith('synthetic-owner');
  }
);
it('waits for identity then vault before launching the requested readers', async () => {
  let unlock!: (value: Buffer) => void;
  api.getDek.mockReturnValue(
    new Promise<Buffer>((resolve) => {
      unlock = resolve;
    })
  );
  const pending = getOverviewReads(['salary', 'expenses']);
  await vi.waitFor(() =>
    expect(api.getDek).toHaveBeenCalledWith('synthetic-owner')
  );
  for (const read of readers) expect(read).not.toHaveBeenCalled();
  unlock(Buffer.alloc(32, 1));
  const bundle = await pending;
  await bundle.salary;
  await bundle.expenses;
  expect(Object.keys(bundle)).toEqual(['salary', 'expenses']);
  expect(api.getSalaryRecords).toHaveBeenCalledOnce();
  expect(api.getExpenses).toHaveBeenCalledOnce();
  expect(api.getSnapshots).not.toHaveBeenCalled();
  expect(api.getPlannerSettings).not.toHaveBeenCalled();
});
it.each([
  [],
  ['salary', 'salary'],
  ['unknown'],
  ['salary', 'expenses', 'snapshots', 'planner', 'salary'],
  ['salary', 'expenses', 'snapshots', 'planner', 'trades', 'salary'],
  'salary',
  null,
])(
  'rejects invalid requested sources%j without feature reads',
  async (input) => {
    await expect(getOverviewReads(input)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    for (const read of readers) expect(read).not.toHaveBeenCalled();
  }
);
it('returns independently pending outcomes without waiting for the slow source', async () => {
  let complete!: (value: []) => void;
  api.getSnapshots.mockReturnValue(
    new Promise<[]>((resolve) => {
      complete = resolve;
    })
  );
  const bundle = await getOverviewReads(['snapshots', 'salary']);
  await expect(bundle.salary).resolves.toEqual({ ok: true, data: [] });
  let done = false;
  void bundle.snapshots?.then(() => {
    done = true;
  });
  expect(done).toBe(false);
  complete([]);
  await expect(bundle.snapshots).resolves.toEqual({ ok: true, data: [] });
});
it('handles every source failure immediately and returns only opaque outcomes', async () => {
  for (const read of readers)
    read.mockRejectedValue(new Error('private table/key detail'));
  const bundle = await getOverviewReads([
    'snapshots',
    'salary',
    'planner',
    'expenses',
    'trades',
  ]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const outcomes = await Promise.all(Object.values(bundle));
  expect(outcomes).toEqual(
    Array.from({ length: 5 }, () => ({ ok: false, code: 'UNAVAILABLE' }))
  );
  expect(JSON.stringify(outcomes)).not.toContain('private');
});
