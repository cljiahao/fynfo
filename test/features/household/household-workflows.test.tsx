// @vitest-environment jsdom
import { CreateGoalDialog } from '@/features/household/components/create-goal-dialog';
import { GoalList } from '@/features/household/components/goal-list';
import { HouseholdOverview } from '@/features/household/components/household-overview';
import { HouseholdSetup } from '@/features/household/components/household-setup';
import { InvitePanel } from '@/features/household/components/invite-panel';
import type { HouseholdGoal } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  createHousehold: vi.fn(),
  acceptInvite: vi.fn(),
  createInvite: vi.fn(),
  getHousehold: vi.fn(),
  unlockHousehold: vi.fn(),
  createGoal: vi.fn(),
  addContribution: vi.fn(),
  deleteGoal: vi.fn(),
  getGoals: vi.fn(),
}));
const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/features/household/actions/household-actions', () => actions);
vi.mock('@/features/household/actions/goal-actions', () => actions);
vi.mock('sonner', () => ({ toast: notices }));

const goal: HouseholdGoal = {
  id: 'g1',
  name: 'Sofa',
  targetAmount: 1000,
  targetDate: '2027-01-01',
  createdAt: '2026-10-01',
  contributed: 300,
  remaining: 700,
  pct: 30,
  contributions: [
    { id: 'c1', amount: 100, note: null, date: '2026-10-01', isSelf: true },
    { id: 'c2', amount: 200, note: 'Bonus', date: '2026-10-02', isSelf: false },
  ],
};
function mount(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  actions.createHousehold.mockResolvedValue({ householdId: 'h1' });
  actions.acceptInvite.mockResolvedValue({ householdId: 'h1' });
  actions.createInvite.mockResolvedValue({ secret: 'one-time-fixture' });
  actions.createGoal.mockResolvedValue(undefined);
  actions.addContribution.mockResolvedValue(undefined);
  actions.deleteGoal.mockResolvedValue(undefined);
});

describe('household overview read and unlock boundaries', () => {
  const household = {
    id: 'h1',
    name: 'Home',
    role: 'owner',
    createdAt: '2026-10-01',
    locked: false,
  };
  it('shows setup when there is no household and an error instead of setup on failed read', async () => {
    actions.getHousehold.mockResolvedValue(null);
    mount(<HouseholdOverview />);
    expect(
      await screen.findByRole('button', { name: 'Create household' })
    ).toBeInTheDocument();
    cleanup();
    actions.getHousehold.mockRejectedValue(new Error('failed'));
    mount(<HouseholdOverview />);
    expect(
      await screen.findByText("Couldn't load your household")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create household' })
    ).not.toBeInTheDocument();
  });
  it('keeps cached goals hidden while locked then refetches household and goals after unlock', async () => {
    actions.getHousehold
      .mockResolvedValueOnce({ ...household, locked: true })
      .mockResolvedValue(household);
    actions.getGoals.mockResolvedValue([goal]);
    actions.unlockHousehold.mockResolvedValue(undefined);
    const client = mount(<HouseholdOverview />);
    client.setQueryData(['household-goals'], [goal]);
    await screen.findByText('Household locked');
    expect(screen.queryByText('Sofa')).not.toBeInTheDocument();
    expect(actions.getGoals).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Unlock household' })
    );
    expect(await screen.findByText('Sofa')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Generate invite code' })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New goal' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('reports failed unlock without revealing goals', async () => {
    actions.getHousehold.mockResolvedValue({ ...household, locked: true });
    actions.unlockHousehold.mockRejectedValue(new Error('locked'));
    mount(<HouseholdOverview />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Unlock household' })
    );
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith(
        'Unlock your personal vault first, then try again.'
      )
    );
    expect(
      screen.queryByRole('button', { name: 'New goal' })
    ).not.toBeInTheDocument();
  });
  it('member reads show goals without owner invite and failed goals read is not mislabeled locked', async () => {
    actions.getHousehold.mockResolvedValue({ ...household, role: 'member' });
    actions.getGoals.mockResolvedValue([]);
    mount(<HouseholdOverview />);
    expect(await screen.findByText('No goals yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Generate invite code' })
    ).not.toBeInTheDocument();
    cleanup();
    actions.getGoals.mockRejectedValue(new Error('failed'));
    mount(<HouseholdOverview />);
    expect(
      await screen.findByText("Couldn't load your goals")
    ).toBeInTheDocument();
    expect(screen.queryByText('Household locked')).not.toBeInTheDocument();
  });
});
afterEach(cleanup);

describe('household workflows with real mutation hooks', () => {
  it('rejects blank setup values and trims valid names and invite codes', async () => {
    mount(<HouseholdSetup />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Create household' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Join household' })
    );
    expect(actions.createHousehold).not.toHaveBeenCalled();
    expect(actions.acceptInvite).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Household name'), '  Home  ');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create household' })
    );
    await waitFor(() =>
      expect(actions.createHousehold).toHaveBeenCalledWith({ name: 'Home' })
    );
    await userEvent.type(
      screen.getByLabelText('Invite code'),
      '  partner-code  '
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Join household' })
    );
    await waitFor(() =>
      expect(actions.acceptInvite).toHaveBeenCalledWith({
        secret: 'partner-code',
      })
    );
    expect(notices.success).toHaveBeenCalledWith('Joined the household');
  });
  it('keeps pending creation disabled and reports failed creation and joining', async () => {
    let reject!: (error: Error) => void;
    actions.createHousehold.mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      })
    );
    actions.acceptInvite.mockRejectedValue(new Error('invalid'));
    mount(<HouseholdSetup />);
    await userEvent.type(screen.getByLabelText('Household name'), 'Home');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create household' })
    );
    expect(
      screen.getByRole('button', { name: 'Create household' })
    ).toBeDisabled();
    reject(new Error('failed'));
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith(
        'Could not create the household'
      )
    );
    await userEvent.type(screen.getByLabelText('Invite code'), 'bad');
    await userEvent.click(
      screen.getByRole('button', { name: 'Join household' })
    );
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith(
        'That invite code is not valid'
      )
    );
  });
  it('reveals generated invite once and copies precisely that invite', async () => {
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, 'writeText');
    mount(<InvitePanel />);
    await user.click(
      screen.getByRole('button', { name: 'Generate invite code' })
    );
    expect(await screen.findByLabelText('One-time invite code')).toHaveValue(
      'one-time-fixture'
    );
    expect(
      screen.queryByRole('button', { name: 'Generate invite code' })
    ).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Copy invite code'));
    expect(copy).toHaveBeenCalledWith('one-time-fixture');
    fireEvent.focus(screen.getByLabelText('One-time invite code'));
  });
  it('does not reveal an invite when generation fails', async () => {
    actions.createInvite.mockRejectedValue(new Error('failed'));
    mount(<InvitePanel />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate invite code' })
    );
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith('Could not create an invite')
    );
    expect(
      screen.queryByLabelText('One-time invite code')
    ).not.toBeInTheDocument();
  });
  it('reports clipboard denial while retaining the generated invite for manual sharing', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('denied')
    );
    mount(<InvitePanel />);
    await user.click(
      screen.getByRole('button', { name: 'Generate invite code' })
    );
    await screen.findByLabelText('One-time invite code');
    await user.click(screen.getByLabelText('Copy invite code'));
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith(
        'Could not copy the invite code'
      )
    );
    expect(screen.getByLabelText('One-time invite code')).toHaveValue(
      'one-time-fixture'
    );
    expect(notices.success).not.toHaveBeenCalledWith('Invite code copied');
  });
  it('validates goal input then creates normalized goal and clears fields after success', async () => {
    const close = vi.fn();
    mount(<CreateGoalDialog open onOpenChange={close} />);
    await userEvent.click(screen.getByRole('button', { name: 'Create goal' }));
    expect(actions.createGoal).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Name'), '  Sofa  ');
    await userEvent.type(screen.getByLabelText('Target amount (SGD)'), '1000');
    fireEvent.change(screen.getByLabelText('Target date (optional)'), {
      target: { value: '2027-01-01' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Create goal' }));
    await waitFor(() =>
      expect(actions.createGoal.mock.calls[0]?.[0]).toEqual({
        name: 'Sofa',
        targetAmount: 1000,
        targetDate: '2027-01-01',
      })
    );
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });
  it('preserves failed goal input for retry and allows cancel without mutation', async () => {
    actions.createGoal.mockRejectedValue(new Error('failed'));
    const close = vi.fn();
    mount(<CreateGoalDialog open onOpenChange={close} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Sofa');
    await userEvent.type(screen.getByLabelText('Target amount (SGD)'), '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Create goal' }));
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith('Could not create the goal')
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Sofa');
    expect(close).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalledWith(false);
  });
  it('shows empty goals and renders each partners contribution and remaining amount', async () => {
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <GoalList goals={[]} />
      </QueryClientProvider>
    );
    expect(screen.getByText('No goals yet')).toBeInTheDocument();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <GoalList
          goals={[
            goal,
            {
              ...goal,
              id: 'g2',
              name: 'Trip',
              targetAmount: 300,
              targetDate: null,
              remaining: 0,
              pct: 100,
            },
          ]}
        />
      </QueryClientProvider>
    );
    expect(screen.getAllByText(/You.*100/)).toHaveLength(2);
    expect(screen.getAllByText(/Partner.*200/)).toHaveLength(2);
    expect(screen.getByText('Funded')).toBeInTheDocument();
    expect(screen.getByText(/700.00 to go/)).toBeInTheDocument();
  });
  it('adds contribution with date and trimmed note then closes dialog', async () => {
    mount(<GoalList goals={[goal]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add to goal' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Add contribution' })
    );
    expect(actions.addContribution).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Amount (SGD)'), '50');
    await userEvent.type(screen.getByLabelText('Note (optional)'), '  Bonus  ');
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-10-08' },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Add contribution' })
    );
    await waitFor(() =>
      expect(actions.addContribution.mock.calls[0]?.[0]).toEqual({
        goalId: 'g1',
        amount: 50,
        date: '2026-10-08',
        note: 'Bonus',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });
  it('retains failed contribution for retry and reports delete errors', async () => {
    actions.addContribution.mockRejectedValue(new Error('failed'));
    actions.deleteGoal
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValue(undefined);
    mount(<GoalList goals={[goal]} />);
    await userEvent.click(screen.getByLabelText('Delete goal Sofa'));
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith('Could not delete the goal')
    );
    await userEvent.click(screen.getByLabelText('Delete goal Sofa'));
    await waitFor(() =>
      expect(notices.success).toHaveBeenCalledWith('Goal deleted')
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add to goal' }));
    await userEvent.type(screen.getByLabelText('Amount (SGD)'), '50');
    await userEvent.click(
      screen.getByRole('button', { name: 'Add contribution' })
    );
    await waitFor(() =>
      expect(notices.error).toHaveBeenCalledWith(
        'Could not add the contribution'
      )
    );
    expect(screen.getByLabelText('Amount (SGD)')).toHaveValue(50);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
