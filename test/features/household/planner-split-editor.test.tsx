// @vitest-environment jsdom
import { PlannerSplitEditor } from '@/features/household/components/planner-split-editor';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ME = '11111111-1111-4111-8111-111111111111';
const PARTNER = '22222222-2222-4222-8222-222222222222';

const external = vi.hoisted(() => ({
  getPlannerSplit: vi.fn(),
  setPlannerSplit: vi.fn(),
}));

vi.mock('@/features/household/actions/planner-actions', () => external);
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
    expect(screen.queryByLabelText(/your share/i)).not.toBeInTheDocument();
    await userEvent.click(summary);
    expect(screen.getByLabelText(/your share/i)).toHaveValue(60);
  });

  it('shows the default state, the partner notice, and saves the new split', async () => {
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
    expect(screen.getByText(/your partner sees any change/i)).toBeVisible();

    const field = screen.getByLabelText(/your share/i);
    await userEvent.clear(field);
    await userEvent.type(field, '70');
    expect(screen.getByText('Partner: 30%')).toBeVisible();
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
    const field = await screen.findByLabelText(/your share/i);
    expect(screen.queryByText(/not set yet/i)).not.toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, '12.5');
    expect(screen.getByRole('button', { name: /save split/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i);
  });
});
