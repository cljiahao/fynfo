// @vitest-environment jsdom
import { EditPaymentDialog } from '@/features/household/components/edit-payment-dialog';
import type { GoalItemPayment } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SELF = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
  memberIds: [] as string[],
  mutate: vi.fn(),
}));

vi.mock('@/features/household/hooks/use-household', () => ({
  useHousehold: () => ({
    data: {
      memberCount: mocks.memberIds.length,
      memberIds: mocks.memberIds,
      userId: '11111111-1111-4111-8111-111111111111',
    },
  }),
  useUpdateGoalPayment: () => ({ mutate: mocks.mutate, isPending: false }),
}));
vi.mock('@/features/privacy', () => ({
  AmountsHiddenNotice: () => null,
  useAmountVisibility: () => ({
    hidden: false,
    mask: (value: string) => value,
    canReveal: () => true,
  }),
}));

const payment = (userId: string): GoalItemPayment => ({
  id: '123e4567-e89b-42d3-a456-426614174000',
  amount: 20,
  note: null,
  date: '2026-11-19',
  userId,
  isSelf: userId === SELF,
});

function renderDialog(p: GoalItemPayment, goalMemberIds?: string[]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditPaymentDialog
        payment={p}
        itemName="Sofa"
        goalMemberIds={goalMemberIds}
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  mocks.mutate.mockReset();
  mocks.memberIds = [];
});

describe('Paid by picker', () => {
  it('lists household members and submits the changed payer id', async () => {
    mocks.memberIds = [SELF, B, C];
    renderDialog(payment(B));
    expect(screen.getByRole('button', { name: 'Member 1' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Member 2' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'You' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(mocks.mutate.mock.calls[0][0]).toMatchObject({ payerUserId: SELF });
  });

  it('limits the choices to the goal members when the goal has any', () => {
    mocks.memberIds = [SELF, B, C];
    renderDialog(payment(SELF), [SELF, C]);
    expect(screen.getByRole('button', { name: 'Member 2' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Member 1' })).toBeNull();
  });

  it('is hidden and omits payerUserId for a one-member household', async () => {
    mocks.memberIds = [SELF];
    renderDialog(payment(SELF));
    expect(screen.queryByText('Paid by')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(mocks.mutate.mock.calls[0][0]).not.toHaveProperty('payerUserId');
  });
});
