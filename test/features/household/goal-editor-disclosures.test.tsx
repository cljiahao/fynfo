// @vitest-environment jsdom
import { GoalEditorDialog } from '@/features/household/components/goal-editor-dialog';
import type { PlannerSplit } from '@/features/household/types';
import { AmountVisibilityProvider } from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { goalWithItems, makeGoal } from './fixtures';

const external = vi.hoisted(() => ({
  split: { current: undefined as PlannerSplit | undefined },
  mutate: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/features/household/hooks/use-household', () => ({
  useSaveGoal: () => ({ mutate: external.mutate, isPending: false }),
  useUpdateGoal: () => ({ mutate: external.update, isPending: false }),
  useHousehold: () => ({
    data: { memberIds: ['me', 'partner'], userId: 'me' },
  }),
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

function mount(goal?: Parameters<typeof GoalEditorDialog>[0]['goal']) {
  render(
    <AmountVisibilityProvider>
      <GoalEditorDialog open onOpenChange={() => {}} goal={goal} />
    </AmountVisibilityProvider>
  );
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

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

  it('has no cost breakdown or item lines when editing a goal', () => {
    mount(goalWithItems);
    expect(
      screen.queryByRole('button', { name: 'Break down the cost' })
    ).toBeNull();
    expect(screen.queryByLabelText('Item 1 name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
  });

  it('seeds item lines from a template on a new goal', async () => {
    mount();
    await userEvent.click(
      screen.getByRole('button', { name: 'Break down the cost' })
    );
    await userEvent.click(screen.getByLabelText('Start from a template'));
    await userEvent.click(
      await screen.findByRole('option', { name: 'Wedding' })
    );
    expect(screen.getByLabelText('Item 1 name')).toHaveValue('Venue');
    expect(screen.getByLabelText('Item 5 name')).toHaveValue('Rings');
    expect(screen.getByLabelText('Item 1 estimate')).toHaveValue(null);
  });

  it('reopens Different split and shows the error when the share is invalid', async () => {
    external.split.current = split({ g1: { [ME]: 70, [PARTNER]: 30 } });
    mount(makeGoal({ memberIds: [ME, PARTNER] }));
    const toggle = screen.getByRole('button', { name: 'Different split' });
    const share = screen.getByLabelText('You share (%)');
    await userEvent.clear(share);
    await userEvent.type(share, '150');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getAllByText('Enter a whole number from 0 to 100').length
    ).toBeGreaterThan(0);
  });

  it('reopens the breakdown and shows item errors on client validation', async () => {
    mount();
    const toggle = screen.getByRole('button', { name: 'Break down the cost' });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.type(screen.getByLabelText('Name'), 'Sofa');
    await userEvent.type(screen.getByLabelText('Target amount (SGD)'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Create goal' }));
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
    mount();
    const toggle = screen.getByRole('button', { name: 'Break down the cost' });
    await userEvent.type(screen.getByLabelText('Name'), 'Sofa');
    await userEvent.type(screen.getByLabelText('Target amount (SGD)'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Create goal' }));
    expect(
      await screen.findByText('Check the highlighted fields')
    ).toBeVisible();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps Different split closed without an override and open with one', () => {
    external.split.current = split({});
    mount(makeGoal());
    expect(
      screen.getByRole('button', { name: 'Different split' })
    ).toHaveAttribute('aria-expanded', 'false');
    cleanup();

    external.split.current = split({ g1: { [ME]: 70, [PARTNER]: 30 } });
    mount(makeGoal({ memberIds: [ME, PARTNER] }));
    expect(
      screen.getByRole('button', { name: 'Different split' })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(screen.getByTestId('goal-split')).getByDisplayValue('70')
    ).toBeInTheDocument();
  });

  it('reseeds an even split when the stored override no longer matches the goal members', () => {
    external.split.current = split({ g1: { [ME]: 60, gone: 40 } });
    mount(makeGoal({ memberIds: [ME, PARTNER] }));
    expect(
      within(screen.getByTestId('goal-split')).getByText(
        'You 50%, Member 2 50%'
      )
    ).toBeInTheDocument();
  });

  it('does not block saving on a stale split the user never touched', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    external.split.current = split({ [id]: { [ME]: 60, gone: 40 } });
    mount(makeGoal({ id, memberIds: [ME, PARTNER] }));
    await userEvent.clear(screen.getByLabelText('Target amount (SGD)'));
    await userEvent.type(screen.getByLabelText('Target amount (SGD)'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() => expect(external.update).toHaveBeenCalled());
  });

  it('says the shares must total 100 when every value is a valid percent', async () => {
    external.split.current = split({ g1: { [ME]: 70, [PARTNER]: 30 } });
    mount(makeGoal({ memberIds: [ME, PARTNER] }));
    const share = screen.getByLabelText('You share (%)');
    await userEvent.clear(share);
    await userEvent.type(share, '60');
    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));
    expect(screen.getAllByText('Shares must total 100%').length).toBe(2);
    expect(screen.queryByText('Enter a whole number from 0 to 100')).toBeNull();
  });
});
