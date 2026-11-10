// @vitest-environment jsdom
import { GoalEditorSheet } from '@/features/household/components/goal-editor-sheet';
import type { PlannerSplit } from '@/features/household/types';
import { AmountVisibilityProvider } from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goalWithItems, makeGoal } from './fixtures';

const external = vi.hoisted(() => ({
  split: { current: undefined as PlannerSplit | undefined },
  mutate: vi.fn(),
}));

vi.mock('@/features/household/hooks/use-household', () => ({
  useSaveGoal: () => ({ mutate: external.mutate, isPending: false }),
}));
vi.mock('@/features/household/hooks/use-planner-split', () => ({
  usePlannerSplit: () => ({ data: external.split.current }),
  useSetPlannerSplit: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const ME = 'me';
const PARTNER = 'partner';

function split(goalOverrides: PlannerSplit['goalOverrides']): PlannerSplit {
  return {
    members: { [ME]: 50, [PARTNER]: 50 },
    goalOverrides,
    budgetOverrides: {},
    isDefault: false,
    userId: ME,
  } as PlannerSplit;
}

function mount(goal?: Parameters<typeof GoalEditorSheet>[0]['goal']) {
  render(
    <AmountVisibilityProvider>
      <GoalEditorSheet open onOpenChange={() => {}} goal={goal} />
    </AmountVisibilityProvider>
  );
}

afterEach(() => {
  cleanup();
  external.split.current = undefined;
  vi.clearAllMocks();
});

describe('goal editor disclosures', () => {
  it('shows only name, amount and date on a new goal', () => {
    external.split.current = split({});
    mount();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Target amount (SGD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Target date (optional)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Break down the cost' })
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: 'Different split' })
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
    expect(screen.queryByTestId('goal-split')).toBeNull();
  });

  it('opens the cost breakdown on demand and offers quote and dates', async () => {
    mount();
    await userEvent.click(
      screen.getByRole('button', { name: 'Break down the cost' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.queryByLabelText('Item 1 due date')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Add payment dates' })
    );
    expect(screen.getByLabelText('Item 1 due date')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Got a final quote?' })
    );
    expect(screen.getByLabelText('Item 1 final quote')).toBeInTheDocument();
  });

  it('auto-opens the breakdown for a goal with items, without dates or quotes', () => {
    mount(goalWithItems);
    expect(
      screen.getByRole('button', { name: 'Break down the cost' })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Item 1 name')).toHaveValue('Venue');
    expect(screen.queryByLabelText('Item 1 due date')).toBeNull();
    expect(screen.queryByLabelText('Item 1 final quote')).toBeNull();
  });

  it('shows the stored due date and quote of an existing item', () => {
    const [first, ...rest] = goalWithItems.items;
    mount({
      ...goalWithItems,
      id: '33333333-3333-4333-8333-333333333333',
      items: [{ ...first!, dueDate: '2027-01-15', quote: 7500 }, ...rest],
    });
    expect(screen.getByLabelText('Item 1 due date')).toHaveValue('2027-01-15');
    expect(screen.getByLabelText('Item 1 final quote')).toHaveDisplayValue(
      '7500.00'
    );
  });

  it('reopens Different split and shows the error when the share is invalid', async () => {
    external.split.current = split({ g1: { [ME]: 70, [PARTNER]: 30 } });
    mount(makeGoal());
    const toggle = screen.getByRole('button', { name: 'Different split' });
    const share = screen.getByLabelText('Your share (%)');
    await userEvent.clear(share);
    await userEvent.type(share, '150');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(
      screen.getByRole('button', { name: 'Review changes' })
    );
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getAllByText('Enter a whole number from 0 to 100').length
    ).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Changes to save')).toBeNull();
  });

  it('reopens the breakdown and shows item errors on client validation', async () => {
    mount(goalWithItems);
    await userEvent.clear(screen.getByLabelText('Item 1 name'));
    const toggle = screen.getByRole('button', { name: 'Break down the cost' });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(
      screen.getByRole('button', { name: 'Review changes' })
    );
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('Each item needs a name and an estimate above 0')
    ).toBeInTheDocument();
  });

  it('reopens the breakdown after a server validation failure', async () => {
    external.mutate.mockImplementation(
      (_draft: unknown, options: { onSuccess: (r: unknown) => void }) =>
        options.onSuccess({
          ok: false,
          code: 'VALIDATION',
          error: { formErrors: [], fieldErrors: {} },
        })
    );
    const uuids = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];
    mount({
      ...goalWithItems,
      id: '33333333-3333-4333-8333-333333333333',
      items: goalWithItems.items.map((item, index) => ({
        ...item,
        id: uuids[index]!,
      })),
    });
    const toggle = screen.getByRole('button', { name: 'Break down the cost' });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(screen.getByLabelText('Target amount (SGD)'), {
      target: { value: '12000' },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Review changes' })
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm and save' })
    );
    expect(
      await screen.findByText('Check the highlighted fields')
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Break down the cost' })
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps Different split closed without an override and open with one', () => {
    external.split.current = split({});
    mount(makeGoal());
    expect(
      screen.getByRole('button', { name: 'Different split' })
    ).toHaveAttribute('aria-expanded', 'false');
    cleanup();

    external.split.current = split({ g1: { [ME]: 70, [PARTNER]: 30 } });
    mount(makeGoal());
    expect(
      screen.getByRole('button', { name: 'Different split' })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(screen.getByTestId('goal-split')).getByDisplayValue('70')
    ).toBeInTheDocument();
  });
});
