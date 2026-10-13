// @vitest-environment jsdom
import { MerchantRuleManager } from '@/features/merchant-rules/components/merchant-rule-manager';
import { useMerchantRulebook } from '@/features/merchant-rules/hooks/use-merchant-rulebook';
import type {
  MerchantRule,
  SaveRulebookInput,
} from '@/features/merchant-rules/types';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
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
function Harness() {
  const rulebook = useMerchantRulebook();
  const [draft, onDraft] = useState<MerchantRule | null>(null);
  return (
    <>
      <AmountVisibilityToggle />
      <MerchantRuleManager
        rulebook={rulebook}
        draft={draft}
        onDraft={onDraft}
        examples={[{ description: 'INVENTED MARKET', bank: 'uob' }]}
      />
    </>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(null);
  mocks.save.mockImplementation(async (input: SaveRulebookInput) => ({
    status: 'saved',
    revision: String(BigInt(input.expectedRevision) + BigInt(1)),
  }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function open() {
  render(
    <AmountVisibilityProvider>
      <Harness />
    </AmountVisibilityProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Manage rules' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'New rule' })).toBeEnabled()
  );
}
async function fill() {
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'New rule' }));
  fireEvent.change(screen.getByLabelText('Rule name'), {
    target: { value: 'Market category' },
  });
  fireEvent.change(screen.getByLabelText('Match original description'), {
    target: { value: 'INVENTED MARKET' },
  });
  fireEvent.change(screen.getByLabelText('Suggested category'), {
    target: { value: 'groceries' },
  });
}
it('previews source matches and saves only on explicit activation', async () => {
  await fill();
  expect(
    screen.getByText('1 matching source rows in this statement:')
  ).toBeVisible();
  fireEvent.keyDown(screen.getByLabelText('Rule name'), { key: 'Enter' });
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
  await screen.findByText(
    'Merchant rules saved. Existing expenses are unchanged.'
  );
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.save.mock.calls[0][0].payload.rules[0].category).toBe(
    'groceries'
  );
});
it('preserves draft fields and masks native values through Hide/Show', async () => {
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
  expect(screen.queryByDisplayValue('Market category')).not.toBeInTheDocument();
  expect(screen.queryByText('INVENTED MARKET')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  expect(screen.getByLabelText('Rule name')).toHaveValue('Market category');
  expect(mocks.save).not.toHaveBeenCalled();
});
it('keeps rejected validation visible and refuses canceled discard', async () => {
  await fill();
  fireEvent.change(screen.getByLabelText('Match original description'), {
    target: { value: '---' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter merchant text');
  expect(mocks.save).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel rule edit' }));
  expect(screen.getByLabelText('Rule name')).toHaveValue('Market category');
});
it('supports explicit delete while retaining the empty rulebook identity', async () => {
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
  const button = await screen.findByRole('button', {
    name: 'Delete rule Market category',
  });
  fireEvent.click(button);
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  const [first, second] = mocks.save.mock.calls.map(
    ([input]) => input as SaveRulebookInput
  );
  expect(second.id).toBe(first.id);
  expect(second.expectedRevision).toBe('1');
  expect(second.payload.rules).toEqual([]);
});
it('retains an unknown save until explicit check and never resends', async () => {
  await fill();
  mocks.save.mockResolvedValueOnce({ status: 'unconfirmed' });
  fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Check saved rules' })
  );
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Save rule' })).toBeDisabled();
  expect(mocks.save).toHaveBeenCalledTimes(1);
});
