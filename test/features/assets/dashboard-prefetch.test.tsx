import DashboardOverviewPage from '@/app/dashboard/(overview)/page';
import { OverviewPrefetch } from '@/features/overview';
import { beforeEach, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  getSalaryRecords: vi.fn(),
  getPlannerSettings: vi.fn(),
  getExpenses: vi.fn(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => actions);
vi.mock('@/features/assets/actions/planner-actions', () => actions);
vi.mock('@/features/salary/actions/salary-actions', () => actions);
vi.mock('@/features/expenses/actions/expense-actions', () => actions);
// Spec119: model the preserved Next compiler boundary, not ordinary JS exports.
vi.mock('@/features/assets/hooks/use-snapshots', () => ({
  SNAPSHOTS_KEY: () => null,
}));
vi.mock('@/features/assets/hooks/use-planner-settings', () => ({
  PLANNER_KEY: () => null,
}));
vi.mock('@/features/expenses/hooks/use-expenses', () => ({
  EXPENSE_KEY: () => null,
}));
vi.mock('@/features/salary/hooks/use-salary', () => ({
  SALARY_KEY: () => null,
}));
vi.mock('@/app/dashboard/(overview)/dashboard-overview', () => ({
  DashboardOverview: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  actions.getSnapshots.mockResolvedValue([]);
  actions.getSalaryRecords.mockResolvedValue([]);
  actions.getPlannerSettings.mockResolvedValue(null);
  actions.getExpenses.mockResolvedValue([]);
});

it('prefetches four independent keys despite client hook reference exports', async () => {
  const page = DashboardOverviewPage();
  expect(page.type).toBe(OverviewPrefetch);
  const hydrated = await OverviewPrefetch(page.props);
  for (const read of Object.values(actions))
    expect(read).toHaveBeenCalledOnce();
  expect(
    hydrated.props.state.queries
      .map((query: { queryHash: string }) => query.queryHash)
      .sort()
  ).toEqual([
    '["expenses"]',
    '["planner-settings"]',
    '["salary"]',
    '["snapshots"]',
  ]);
});
it('starts all reads eagerly and waits for the slowest before hydration', async () => {
  let resolveExpenses!: (value: []) => void;
  actions.getExpenses.mockReturnValue(
    new Promise<[]>((resolve) => {
      resolveExpenses = resolve;
    })
  );
  let settled = false;
  const prefetch = OverviewPrefetch({ children: 'overview' }).then(
    (element) => {
      settled = true;
      return element;
    }
  );
  await Promise.resolve();
  for (const read of Object.values(actions))
    expect(read).toHaveBeenCalledOnce();
  expect(settled).toBe(false);
  resolveExpenses([]);
  const hydrated = await prefetch;
  expect(hydrated.props.children).toBe('overview');
  expect(hydrated.props.state.queries).toHaveLength(4);
});

it('hydrates successful sources only, including a missing planner setting', async () => {
  actions.getExpenses.mockRejectedValue(new Error('fixture failure'));
  const hydrated = await OverviewPrefetch({ children: null });
  expect(
    hydrated.props.state.queries
      .map((query: { queryHash: string }) => query.queryHash)
      .sort()
  ).toEqual(['["planner-settings"]', '["salary"]', '["snapshots"]']);
  const planner = hydrated.props.state.queries.find(
    (query: { queryHash: string }) => query.queryHash === '["planner-settings"]'
  );
  expect(planner?.state.data).toBeNull();
});

it('creates a fresh request cache rather than reusing previous owner data', async () => {
  actions.getSnapshots
    .mockResolvedValueOnce([{ id: 'first' }])
    .mockResolvedValueOnce([{ id: 'second' }]);
  const first = await OverviewPrefetch({ children: null });
  const second = await OverviewPrefetch({ children: null });
  const snapshotData = (element: typeof first) =>
    element.props.state.queries.find(
      (query: { queryHash: string }) => query.queryHash === '["snapshots"]'
    )?.state.data;
  expect(snapshotData(first)).toEqual([{ id: 'first' }]);
  expect(snapshotData(second)).toEqual([{ id: 'second' }]);
  for (const read of Object.values(actions))
    expect(read).toHaveBeenCalledTimes(2);
});

it('keeps all denied reads out of the dehydrated cache', async () => {
  for (const read of Object.values(actions))
    read.mockRejectedValue(new Error('denied'));
  const hydrated = await OverviewPrefetch({ children: null });
  expect(hydrated.props.state.queries).toEqual([]);
});
