// @vitest-environment jsdom
import { MerchantSuggestion } from '@/features/merchant-rules/components/merchant-suggestion';
import type { MerchantRule } from '@/features/merchant-rules/types';
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/features/expenses', async () => ({
  EXPENSE_TYPE_LABELS: (await import('@/features/expenses/constants'))
    .EXPENSE_TYPE_LABELS,
}));
const rule: MerchantRule = {
  id: '851af27a-e752-4aa5-8294-44b02bd911ca',
  label: 'Market rule',
  enabled: true,
  matchMode: 'exact',
  matchText: 'MARKET',
  bank: null,
  displayName: 'Market',
  category: 'groceries',
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it.each(['removed', 'disabled', 'changed'] as const)(
  'retains explicit source restoration after an applied rule is %s',
  (change) => {
    const apply = vi.fn();
    const restore = vi.fn();
    const content = (rules: MerchantRule[]) => (
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <MerchantSuggestion
          originalDescription="MARKET"
          bank="uob"
          rules={rules}
          manual={{ description: false, category: false }}
          onApply={apply}
          onRestore={restore}
        />
      </AmountVisibilityProvider>
    );
    const view = render(content([rule]));
    fireEvent.click(screen.getByRole('button', { name: 'Apply suggestion' }));
    expect(apply).toHaveBeenCalledOnce();
    view.rerender(
      content(
        change === 'removed'
          ? []
          : [
              {
                ...rule,
                ...(change === 'disabled'
                  ? { enabled: false }
                  : { matchText: 'DIFFERENT MERCHANT' }),
              },
            ]
      )
    );
    expect(
      screen.queryByRole('button', { name: 'Apply suggestion' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Original description: MARKET')).toBeVisible();
    expect(restore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(
      screen.queryByText('Original description: MARKET')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Review changes / restore',
      })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review changes / restore',
      })
    );
    expect(restore).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledOnce();
  }
);
it('shows the original source, reason and output without applying automatically', () => {
  const apply = vi.fn();
  const restore = vi.fn();
  render(
    <MerchantSuggestion
      originalDescription="MARKET"
      bank="uob"
      rules={[rule]}
      manual={{ description: false, category: false }}
      onApply={apply}
      onRestore={restore}
    />
  );
  expect(screen.getByText('Original description: MARKET')).toBeVisible();
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply suggestion' }));
  expect(apply).toHaveBeenCalledWith(rule, {
    description: false,
    category: false,
  });
});
it('requires a choice for conflict and specific consent to replace a manual field', () => {
  const apply = vi.fn();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(
    <MerchantSuggestion
      originalDescription="MARKET"
      bank="uob"
      rules={[
        rule,
        {
          ...rule,
          id: 'ff65feb2-8ffa-427c-a057-8779580f162f',
          label: 'Other rule',
          category: 'other',
        },
      ]}
      manual={{ description: true, category: true }}
      onApply={apply}
      onRestore={vi.fn()}
    />
  );
  expect(screen.getByText(/Matching rules disagree/)).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Apply suggestion' })
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Replace my merchant name' })[0]
  );
  expect(apply).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Replace my category' })[0]
  );
  expect(apply).toHaveBeenCalledWith(
    { displayName: null, category: 'groceries' },
    { description: false, category: true }
  );
});
it('removes rule and merchant text while hidden and restores after Show', () => {
  const apply = vi.fn();
  render(
    <AmountVisibilityProvider>
      <AmountVisibilityToggle />
      <MerchantSuggestion
        originalDescription="MARKET"
        bank="uob"
        rules={[rule]}
        manual={{ description: false, category: false }}
        onApply={apply}
        onRestore={vi.fn()}
      />
    </AmountVisibilityProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
  expect(
    screen.queryByText('Original description: MARKET')
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Apply suggestion' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  expect(
    screen.getByRole('button', { name: 'Apply suggestion' })
  ).toBeEnabled();
  expect(apply).not.toHaveBeenCalled();
});
