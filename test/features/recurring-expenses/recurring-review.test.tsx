// @vitest-environment jsdom
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import { RecurringReview } from '@/features/recurring-expenses/components/recurring-review';
import { applyRecurringCommand } from '@/features/recurring-expenses/lib/commands';
import type {
  RecurringBook,
  RecurringMutation,
} from '@/features/recurring-expenses/types';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  expenses: vi.fn(),
}));
vi.mock('@/features/recurring-expenses/actions/recurring-actions', () => ({
  getRecurringRulebook: mocks.read,
  mutateRecurringRulebook: mocks.save,
}));
vi.mock('@/features/expenses', async () => ({
  ...(await import('@/features/expenses/constants')),
  getExpenses: mocks.expenses,
}));
vi.mock('@/features/recurring-expenses/lib/calendar', async (original) => ({
  ...(await original<
    typeof import('@/features/recurring-expenses/lib/calendar')
  >()),
  singaporeToday: () => '2026-02-28',
}));
const initial: RecurringBook = {
  id: '13800000-0000-4000-8000-000000000001',
  revision: '1',
  payload: {
    schemaVersion: 1,
    requestId: '13800000-0000-4000-8000-000000000002',
    templates: [
      {
        archived: false,
        occurrences: [],
        definition: {
          id: '13800000-0000-4000-8000-000000000003',
          name: 'Synthetic bill',
          enabled: true,
          preferredDay: 31,
          startMonth: '2026-01',
          endMonth: null,
          cents: 2500,
          category: 'bills',
          item: 'Synthetic merchant',
          info: 'Synthetic notes',
        },
      },
    ],
  },
};
let current: RecurringBook;
beforeEach(() => {
  vi.resetAllMocks();
  current = structuredClone(initial);
  mocks.read.mockImplementation(async () => current);
  mocks.expenses.mockResolvedValue([]);
  mocks.save.mockImplementation(async (input: RecurringMutation) => {
    current = {
      id: input.bookId,
      revision: String(BigInt(input.expectedRevision) + BigInt(1)),
      payload: applyRecurringCommand(current.payload, input, '2026-02-28'),
    };
    return { status: 'saved' };
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function open() {
  render(
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <RecurringReview />
    </AmountVisibilityProvider>
  );
  expect(mocks.read).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review monthly templates' })
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'New monthly template' })
    ).toBeEnabled()
  );
}
async function payment() {
  await open();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review payment for Synthetic bill' })
  );
}
it('shows clamped Singapore dates without saving on open, navigation or Enter', async () => {
  await open();
  expect(screen.getByText(/Due for review · 2026-02-28/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Earlier month' }));
  expect(screen.getByLabelText('Occurrence month')).toHaveValue('2026-01');
  fireEvent.click(screen.getByRole('button', { name: 'Current month' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Review payment for Synthetic bill' })
  );
  fireEvent.keyDown(screen.getByLabelText('Actual merchant'), { key: 'Enter' });
  expect(mocks.save).not.toHaveBeenCalled();
});
it('requires duplicate review, invalidates it after edits, and retains intended month after changing the actual date', async () => {
  await payment();
  const confirm = screen.getByRole('button', {
    name: 'Confirm and save occurrence',
  });
  expect(confirm).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Actual expense date'), {
    target: { value: '2026-03-03' },
  });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Actual SGD amount'), {
    target: { value: '26.50' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await screen.findByText(/Confirmed 2026-02 as SGD 26.50 on 2026-03-03/);
  expect(mocks.save.mock.calls[0][0].command.month).toBe('2026-02');
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole('button', { name: 'Review payment for Synthetic bill' })
  ).not.toBeInTheDocument();
});
it('requires acknowledgement of a possible existing payment', async () => {
  mocks.expenses.mockResolvedValue([
    {
      id: 'saved',
      date: '2026-02-28',
      amount: 25,
      item: 'SYNTHETIC   MERCHANT',
    },
  ]);
  await payment();
  fireEvent.click(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  const ack = await screen.findByLabelText(
    'I compared the possible existing expense and want to record this occurrence.'
  );
  expect(
    screen.getByRole('button', { name: 'Confirm and save occurrence' })
  ).toBeDisabled();
  fireEvent.click(ack);
  expect(
    screen.getByRole('button', { name: 'Confirm and save occurrence' })
  ).toBeEnabled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it('retains native draft values while hiding all sensitive fields and invalidates a previous duplicate check', async () => {
  await payment();
  fireEvent.change(screen.getByLabelText('Actual merchant'), {
    target: { value: 'Private draft merchant' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Confirm and save occurrence' })
    ).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
  expect(
    screen.queryByDisplayValue('Private draft merchant')
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic bill')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Actual merchant')).toHaveValue(
      'Private draft merchant'
    )
  );
  expect(
    screen.getByRole('button', { name: 'Confirm and save occurrence' })
  ).toBeDisabled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it('records Skip once, preserves it on edits, and never records an expense automatically', async () => {
  await open();
  fireEvent.click(
    screen.getByRole('button', { name: 'Skip Synthetic bill this month' })
  );
  await screen.findByText('Skipped 2026-02; no expense recorded.');
  expect(mocks.save.mock.calls[0][0].command.kind).toBe('skip');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Synthetic bill' }));
  fireEvent.change(screen.getByLabelText('Template name'), {
    target: { value: 'Edited bill' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save monthly template' })
  );
  await screen.findByText('Edited bill');
  expect(current.payload.templates[0].occurrences[0].outcome).toBe('skipped');
  expect(mocks.save).toHaveBeenCalledTimes(2);
});
it('keeps a missing linked expense confirmed and makes cloning an explicit new series', async () => {
  const template = current.payload.templates[0];
  template.occurrences.push({
    month: '2026-02',
    requestId: '13800000-0000-4000-8000-000000000005',
    outcome: 'confirmed',
    expense: {
      id: '13800000-0000-4000-8000-000000000006',
      date: '2026-02-28',
      category: 'bills',
      item: 'Actual synthetic bill',
      info: '',
      cents: 2500,
    },
  });
  await open();
  fireEvent.click(
    screen.getByRole('button', { name: 'Check linked expenses' })
  );
  await screen.findByText(
    'Linked expense is missing. This occurrence remains confirmed.'
  );
  expect(
    screen.queryByRole('button', { name: 'Review payment for Synthetic bill' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clone Synthetic bill' }));
  expect(window.confirm).toHaveBeenCalledWith(
    expect.stringContaining('separate monthly series')
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save monthly template' })
  );
  await waitFor(() => expect(current.payload.templates).toHaveLength(2));
  expect(current.payload.templates[1].definition.id).not.toBe(
    template.definition.id
  );
  expect(current.payload.templates[1].occurrences).toEqual([]);
});
it('retains unknown submission until receipt checking and never sends again on Check', async () => {
  await payment();
  mocks.save.mockImplementation(async (input: RecurringMutation) => {
    current = {
      ...current,
      revision: '2',
      payload: applyRecurringCommand(current.payload, input, '2026-02-28'),
    };
    return { status: 'unconfirmed' };
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Confirm and save occurrence' })
    ).toBeEnabled()
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm and save occurrence' })
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Check saved occurrence' })
  );
  await screen.findByText(/Confirmed 2026-02 as SGD/);
  expect(mocks.save).toHaveBeenCalledTimes(1);
});
it('keeps drafts when cancellation is refused and creates no writes for invalid amounts', async () => {
  await payment();
  vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(
    screen.getByRole('button', { name: 'Cancel occurrence review' })
  );
  expect(screen.getByLabelText('Actual merchant')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Actual SGD amount'), {
    target: { value: '0.00' },
  });
  expect(
    screen.getByRole('button', { name: 'Check possible duplicates' })
  ).toBeDisabled();
  expect(mocks.save).not.toHaveBeenCalled();
});
