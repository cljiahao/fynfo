import DashboardOverviewPage from '@/app/dashboard/(overview)/page';
import { expect, it, vi } from 'vitest';

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
vi.mock('@/app/dashboard/(overview)/dashboard-overview', () => ({
  DashboardOverview: () => null,
}));

it('starts independent prefetched reads eagerly but waits for the slowest dataset', async () => {
  let completeExpenses!: (value: []) => void;
  actions.getSnapshots.mockResolvedValue([]);
  actions.getSalaryRecords.mockResolvedValue([]);
  actions.getPlannerSettings.mockResolvedValue(null);
  actions.getExpenses.mockReturnValue(
    new Promise<[]>((resolve) => {
      completeExpenses = resolve;
    })
  );
  let pageReady = false;
  const page = DashboardOverviewPage().then((result) => {
    pageReady = true;
    return result;
  });
  await Promise.resolve();
  for (const read of Object.values(actions))
    expect(read).toHaveBeenCalledOnce();
  expect(pageReady).toBe(false);
  completeExpenses([]);
  const hydrated = await page;
  expect(pageReady).toBe(true);
  expect(hydrated.props.state.queries).toHaveLength(4);
});
