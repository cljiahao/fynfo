// @vitest-environment jsdom
import { PlannerSplitEditor } from '@/features/household/components/planner-split-editor';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ME = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';
const THIRD = '33333333-3333-4333-8333-333333333333';
const FOURTH = '44444444-4444-4444-8444-444444444444';
const ROSTER = [ME, PARTNER, THIRD, FOURTH];

const external = vi.hoisted(() => ({
  getHousehold: vi.fn(),
  getPlannerSplit: vi.fn(),
  setPlannerSplit: vi.fn(),
}));

vi.mock('@/features/household/actions/planner-actions', () => external);
vi.mock('@/features/household/actions/household-actions', () => ({
  getHousehold: external.getHousehold,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function renderEditor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PlannerSplitEditor />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  external.getHousehold.mockResolvedValue({
    memberIds: ROSTER,
    userId: ME,
  });
  external.setPlannerSplit.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlannerSplitEditor', () => {
  it('stays collapsed behind a one-line summary until tapped', async () => {
    external.getPlannerSplit.mockResolvedValue({
      members: { [ME]: 60, [PARTNER]: 40 },
      goalOverrides: {},
      isDefault: false,
      userId: ME,
    });
    renderEditor();
    const summary = await screen.findByRole('button', { name: /you pay 60%/i });
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText(/share \(%\)/i)).not.toBeInTheDocument();
    await userEvent.click(summary);
    expect(screen.getByLabelText('You share (%)')).toHaveValue(60);
    expect(screen.getByLabelText('Member 2 share (%)')).toHaveValue(40);
  });

  it('flags an unset default split on the collapsed summary only', async () => {
    external.getPlannerSplit.mockResolvedValue({
      members: { [ME]: 50, [PARTNER]: 50 },
      goalOverrides: {},
      isDefault: true,
      userId: ME,
    });
    renderEditor();
    const summary = await screen.findByRole('button', { name: /you pay 50%/i });
    expect(screen.getByText(/not set yet/i)).toBeInTheDocument();
    await userEvent.click(summary);
    expect(screen.getAllByText(/not set yet/i)).toHaveLength(1);
  });

  it('shows the default state, the member notice, and saves the new split', async () => {
    external.getPlannerSplit.mockResolvedValue({
      members: { [ME]: 50, [PARTNER]: 50 },
      goalOverrides: {},
      isDefault: true,
      userId: ME,
    });
    renderEditor();

    await userEvent.click(
      await screen.findByRole('button', { name: /you pay 50%/i })
    );
    expect(await screen.findByText(/not set yet/i)).toBeInTheDocument();
    expect(screen.getByText(/other members see any change/i)).toBeVisible();

    const field = screen.getByLabelText('You share (%)');
    await userEvent.clear(field);
    await userEvent.type(field, '70');
    expect(screen.getByText('Over by 20%')).toBeVisible();
    expect(screen.getByRole('button', { name: /save split/i })).toBeDisabled();
    const other = screen.getByLabelText('Member 2 share (%)');
    await userEvent.clear(other);
    await userEvent.type(other, '30');
    expect(screen.getByText('Total 100%')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /save split/i }));

    await waitFor(() =>
      expect(external.setPlannerSplit.mock.calls[0][0]).toEqual({
        members: { [ME]: 70, [PARTNER]: 30 },
      })
    );
  });

  it('blocks saving a non-integer share', async () => {
    external.getPlannerSplit.mockResolvedValue({
      members: { [ME]: 50, [PARTNER]: 50 },
      goalOverrides: {},
      isDefault: false,
      userId: ME,
    });
    renderEditor();

    await userEvent.click(
      await screen.findByRole('button', { name: /you pay 50%/i })
    );
    const field = await screen.findByLabelText('You share (%)');
    expect(screen.queryByText(/not set yet/i)).not.toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, '12.5');
    expect(screen.getByRole('button', { name: /save split/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i);
  });

  it.each([2, 3, 4])(
    'shows one row per member and saves only at 100 for %i members',
    async (count) => {
      const ids = ROSTER.slice(0, count);
      const even = Math.floor(100 / count);
      const members = Object.fromEntries(
        ids.map((id, i) => [id, i === 0 ? 100 - even * (count - 1) : even])
      );
      external.getPlannerSplit.mockResolvedValue({
        members,
        goalOverrides: {},
        isDefault: false,
        userId: ME,
      });
      renderEditor();
      await userEvent.click(
        await screen.findByRole('button', { name: /change split/i })
      );
      expect(screen.getAllByLabelText(/share \(%\)/i)).toHaveLength(count);
      expect(screen.getByText('Total 100%')).toBeVisible();
      const save = screen.getByRole('button', { name: /save split/i });
      expect(save).toBeEnabled();

      const first = screen.getByLabelText('You share (%)');
      await userEvent.clear(first);
      await userEvent.type(first, '5');
      expect(save).toBeDisabled();
      await userEvent.clear(first);
      await userEvent.type(first, String(members[ME]));
      expect(save).toBeEnabled();
      await userEvent.click(save);
      await waitFor(() =>
        expect(external.setPlannerSplit.mock.calls[0][0]).toEqual({ members })
      );
    }
  );
});
