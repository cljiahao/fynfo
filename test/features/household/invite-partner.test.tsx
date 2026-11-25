// @vitest-environment jsdom
import { HouseholdOverview } from '@/features/household/components/household-overview';
import { InvitePartnerDialog } from '@/features/household/components/invite-partner-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  createInvite: vi.fn(),
  getHousehold: vi.fn(),
  unlockHousehold: vi.fn(),
  getGoals: vi.fn(),
  getSpaces: vi.fn(),
}));
const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/features/household/actions/household-actions', () => actions);
vi.mock('@/features/household/actions/goal-actions', () => actions);
vi.mock('@/features/household/actions/spending-actions', () => actions);
vi.mock('sonner', () => ({ toast: notices }));
vi.mock('@/features/household/components/goal-list', () => ({
  GoalList: () => <div>Goals</div>,
}));
vi.mock('@/features/household/components/household-plan-summary', () => ({
  HouseholdPlanSummary: () => null,
}));
vi.mock('@/features/household/components/shared-spending', () => ({
  SharedSpending: () => <div>Spending</div>,
}));

const household = {
  id: 'h1',
  name: 'Home',
  role: 'owner',
  createdAt: '2026-10-01',
  memberCount: 1,
  locked: false,
};

function mount(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  vi.resetAllMocks();
  actions.createInvite.mockResolvedValue({ secret: 'one-time-fixture' });
  actions.getHousehold.mockResolvedValue(household);
  actions.getGoals.mockResolvedValue([]);
  actions.getSpaces.mockResolvedValue([]);
});
afterEach(cleanup);

const inviteButton = () =>
  screen.findByRole('button', { name: 'Invite partner' });

describe('invite partner entry point', () => {
  it('is shown to an owner with a free seat, beside the spending link', async () => {
    mount(<HouseholdOverview />);
    expect(await inviteButton()).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Shared spending' })
    ).toBeInTheDocument();
  });

  it('is shown while the household is locked, without the create action', async () => {
    actions.getHousehold.mockResolvedValue({ ...household, locked: true });
    mount(<HouseholdOverview />);
    expect(await inviteButton()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New goal' })).toBeNull();
  });

  it('is replaced by a members note when the household is full', async () => {
    actions.getHousehold.mockResolvedValue({ ...household, memberCount: 2 });
    mount(<HouseholdOverview />);
    expect(await screen.findByText('2 of 2 members')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite partner' })).toBeNull();
  });

  it('tells a non-owner that only the owner can invite', async () => {
    actions.getHousehold.mockResolvedValue({ ...household, role: 'member' });
    mount(<HouseholdOverview />);
    expect(
      await screen.findByText('Only the owner can invite a partner')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite partner' })).toBeNull();
  });
});

describe('invite partner dialog', () => {
  it('generates once, copies the code and forgets it when closed', async () => {
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, 'writeText');
    mount(<InvitePartnerDialog />);

    await user.click(screen.getByRole('button', { name: 'Invite partner' }));
    await user.click(
      screen.getByRole('button', { name: 'Generate invite code' })
    );
    expect(await screen.findByLabelText('One-time invite code')).toHaveValue(
      'one-time-fixture'
    );
    expect(actions.createInvite).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('Copy invite code'));
    expect(copy).toHaveBeenCalledWith('one-time-fixture');
    expect(notices.success).toHaveBeenCalledWith('Invite code copied');

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByLabelText('One-time invite code')).toBeNull()
    );

    await user.click(screen.getByRole('button', { name: 'Invite partner' }));
    expect(
      await screen.findByRole('button', { name: 'Generate invite code' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('One-time invite code')).toBeNull();
  });
});
