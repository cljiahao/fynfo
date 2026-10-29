// @vitest-environment jsdom
import { MerchantRulesButton } from '@/features/merchant-rules/components/merchant-rules-dialog';
import type { MerchantRule } from '@/features/merchant-rules/types';
import { AmountVisibilityProvider } from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock('@/features/merchant-rules/actions/rulebook-actions', () => ({
  getMerchantRulebook: mocks.read,
  saveMerchantRulebook: mocks.save,
}));
vi.mock('@/features/expenses', async () => ({
  EXPENSE_TYPE_LABELS: (await import('@/features/expenses/constants'))
    .EXPENSE_TYPE_LABELS,
}));

function rule(index: number): MerchantRule {
  return {
    id: crypto.randomUUID(),
    label: `Shop ${index}`,
    enabled: true,
    matchMode: 'exact',
    matchText: index === 7 ? 'KOPI CORNER' : `SHOP ${index}`,
    bank: null,
    displayName: index === 12 ? 'Bakery' : null,
    category: 'other',
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue({
    id: crypto.randomUUID(),
    revision: '1',
    payload: {
      schemaVersion: 1,
      requestId: crypto.randomUUID(),
      rules: Array.from({ length: 23 }, (_, index) => rule(index + 1)),
    },
  });
  vi.spyOn(window, 'confirm').mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function open() {
  render(
    <AmountVisibilityProvider>
      <MerchantRulesButton />
    </AmountVisibilityProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Merchant rules' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'New rule' })).toBeEnabled()
  );
}

it('opens saved rules without a statement and pages them by ten', async () => {
  await open();
  expect(mocks.read).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Page 1 of 3 · 23 rules')).toBeVisible();
  expect(screen.getByText('Shop 10')).toBeVisible();
  expect(screen.queryByText('Shop 11')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Shop 11')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Shop 23')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

it('searches rule name, matching words and Item / Brand', async () => {
  await open();
  const search = screen.getByLabelText('Search rules');
  fireEvent.change(search, { target: { value: 'kopi' } });
  expect(screen.getByText('Shop 7')).toBeVisible();
  expect(screen.queryByText('Shop 1')).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'bakery' } });
  expect(screen.getByText('Shop 12')).toBeVisible();
  fireEvent.change(search, { target: { value: 'nothing here' } });
  expect(screen.getByText('No rules match “nothing here”.')).toBeVisible();
});

it('asks before closing with an unsaved rule and keeps it when declined', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(window.confirm).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Merchant rules' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'New rule' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'New rule' }));
  fireEvent.change(screen.getByLabelText('Rule name'), {
    target: { value: 'Draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(window.confirm).toHaveBeenCalledWith('Discard the unsaved rule?');
  expect(screen.getByLabelText('Rule name')).toHaveValue('Draft');
  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
