// @vitest-environment jsdom
import { EditPaymentDialog } from '@/features/household/components/edit-payment-dialog';
import type { GoalItemPayment } from '@/features/household/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  memberCount: 2,
  mutate: vi.fn(),
}));

vi.mock('@/features/household/hooks/use-household', () => ({
  useHousehold: () => ({ data: { memberCount: mocks.memberCount } }),
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

const payment = (isSelf: boolean): GoalItemPayment => ({
  id: '123e4567-e89b-42d3-a456-426614174000',
  amount: 20,
  note: null,
  date: '2026-11-19',
  isSelf,
});

function renderDialog(p: GoalItemPayment) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditPaymentDialog payment={p} itemName="Sofa" onOpenChange={vi.fn()} />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  mocks.mutate.mockReset();
  mocks.memberCount = 2;
});

describe('Paid by picker', () => {
  it('preselects the current payer and submits a changed payer', async () => {
    renderDialog(payment(false));
    expect(screen.getByRole('button', { name: 'Partner' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await userEvent.click(screen.getByRole('button', { name: 'You' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(mocks.mutate.mock.calls[0][0]).toMatchObject({ paidBy: 'self' });
  });

  it('is hidden and omits paidBy for a one-member household', async () => {
    mocks.memberCount = 1;
    renderDialog(payment(true));
    expect(screen.queryByText('Paid by')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(mocks.mutate.mock.calls[0][0]).not.toHaveProperty('paidBy');
  });
});
