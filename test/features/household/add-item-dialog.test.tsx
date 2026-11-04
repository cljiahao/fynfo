// @vitest-environment jsdom
import { AddItemDialog } from '@/features/household/components/add-item-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeGoal } from './fixtures';

const actions = vi.hoisted(() => ({ addGoalItem: vi.fn() }));
vi.mock('@/features/household/actions/goal-actions', () => actions);
vi.mock('@/features/household/actions/household-actions', () => ({}));

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), toasts) }));

const visibility = vi.hoisted(() => ({ hidden: false }));
vi.mock('@/features/privacy', () => ({
  useAmountVisibility: () => ({
    hidden: visibility.hidden,
    canReveal: () => !visibility.hidden,
    mask: (value: string) => (visibility.hidden ? 'Hidden' : value),
  }),
  AmountsHiddenNotice: () => null,
}));

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span>{open ? 'open' : 'closed'}</span>
      <AddItemDialog goal={makeGoal()} open={open} onOpenChange={setOpen} />
    </>
  );
}

function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <Harness />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  visibility.hidden = false;
  vi.clearAllMocks();
  actions.addGoalItem.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('flags an empty name with focus and an inline error', async () => {
  mount();
  await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  const name = screen.getByLabelText('Item');
  expect(name).toHaveAttribute('aria-invalid', 'true');
  expect(name).toHaveFocus();
  expect(screen.getByText('Enter a name')).toBeInTheDocument();
  expect(actions.addGoalItem).not.toHaveBeenCalled();
  await userEvent.type(name, 'V');
  expect(name).not.toHaveAttribute('aria-invalid');
});

it('flags a non-positive budget', async () => {
  mount();
  await userEvent.type(screen.getByLabelText('Item'), 'Venue');
  await userEvent.type(screen.getByLabelText('Budget'), '0');
  await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  expect(screen.getByLabelText('Budget')).toHaveAttribute(
    'aria-invalid',
    'true'
  );
  expect(screen.getByText('Enter an amount above 0')).toBeInTheDocument();
  expect(actions.addGoalItem).not.toHaveBeenCalled();
});

it('submits a trimmed name and parsed budget, then closes', async () => {
  mount();
  await userEvent.type(screen.getByLabelText('Item'), '  Venue  ');
  await userEvent.type(screen.getByLabelText('Budget'), '8000.5');
  await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  await waitFor(() =>
    expect(actions.addGoalItem).toHaveBeenCalledWith(
      { goalId: 'g1', name: 'Venue', budget: 8000.5 },
      expect.anything()
    )
  );
  await waitFor(() => expect(screen.getByText('closed')).toBeInTheDocument());
  expect(toasts.success).toHaveBeenCalledWith('Item added');
});

it('stays open with the typed values when the save fails', async () => {
  actions.addGoalItem.mockRejectedValue(new Error('boom'));
  mount();
  await userEvent.type(screen.getByLabelText('Item'), 'Venue');
  await userEvent.type(screen.getByLabelText('Budget'), '500');
  await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  await waitFor(() =>
    expect(toasts.error).toHaveBeenCalledWith('Could not add the item')
  );
  expect(screen.getByText('open')).toBeInTheDocument();
  expect(screen.getByLabelText('Item')).toHaveValue('Venue');
  expect(screen.getByLabelText('Budget')).toHaveValue(500);
});

it('keeps the fields empty and disabled while amounts are hidden', () => {
  visibility.hidden = true;
  mount();
  expect(screen.getByLabelText('Item')).toBeDisabled();
  expect(screen.getByLabelText('Item')).toHaveValue('');
  expect(screen.getByLabelText('Budget')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled();
});
