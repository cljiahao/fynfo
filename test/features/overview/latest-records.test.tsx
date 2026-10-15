// @vitest-environment jsdom
import { PageViews } from '@/components/widgets/page-views';
import { LatestRecords } from '@/features/overview/components/latest-records';
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('shows newest recorded periods regardless of order, using the Singapore month boundary', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T16:01:00Z'));
  render(
    <LatestRecords
      snapshots={[
        { id: '2026-09', entries: [] },
        { id: '2026-01', entries: [] },
      ]}
      salary={[
        { id: '2026-10', salary: 100, bonus: 0 },
        { id: '2026-08', salary: 100, bonus: 0 },
      ]}
      expenses={['2026-09-23', '2026-09-01'].map((date) => ({
        id: date,
        date,
        amount: 1,
        item: 'Item',
        info: '',
        type: 'other',
        splitType: 'self',
        splits: [],
      }))}
      assetsState="ready"
      salaryState="ready"
      expensesState="ready"
      retryAssets={() => {}}
      retrySalary={() => {}}
      retryExpenses={() => {}}
    />
  );
  expect(screen.getByText('Latest: Sept 2026')).toBeTruthy();
  expect(screen.getByText('Latest: Oct 2026')).toBeTruthy();
  expect(screen.getByText('Last expense: 23 Sept 2026')).toBeTruthy();
  expect(screen.getAllByText('Earlier than this month')).toHaveLength(1);
  expect(
    screen.getByRole('link', { name: 'Recorded spending' }).getAttribute('href')
  ).toBe('/dashboard/expenses');
});

it('distinguishes pending, failed and empty reads without exposing stale dates', () => {
  const retry = vi.fn();
  render(
    <LatestRecords
      assetsState="loading"
      salaryState="ready"
      expensesState="error"
      expenses={[
        {
          id: 'old',
          date: '2026-01-01',
          amount: 1,
          item: 'Item',
          info: '',
          type: 'other',
          splitType: 'self',
          splits: [],
        },
      ]}
      retryAssets={() => {}}
      retrySalary={() => {}}
      retryExpenses={retry}
    />
  );
  expect(screen.getByRole('status', { name: 'Loading assets' })).toBeTruthy();
  expect(screen.getAllByText('No records yet')).toHaveLength(1);
  expect(screen.getByText('Couldn’t load expenses')).toBeTruthy();
  expect(screen.queryByText(/Jan 2026/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledOnce();
});

it('keeps a draft when switching tasks and exposes only the selected region', () => {
  render(
    <PageViews
      label="Test views"
      views={[
        {
          id: 'entry',
          label: 'Entry',
          content: <input aria-label="Draft" defaultValue="" />,
        },
        { id: 'review', label: 'Review', content: <p>Review content</p> },
      ]}
    />
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), {
    target: { value: 'Unsaved' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getAllByRole('region')).toHaveLength(1);
  expect(
    within(screen.getByRole('region', { name: 'Review' })).getByText(
      'Review content'
    )
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Entry' }));
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(
    'Unsaved'
  );
  expect(
    screen.getByRole('button', { name: 'Entry' }).getAttribute('aria-pressed')
  ).toBe('true');
});

function HideAmounts() {
  const { hideAmounts } = useAmountVisibility();
  return <button onClick={hideAmounts}>Hide</button>;
}

it('summarizes this Singapore month using personal shares and masks every monetary figure', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T16:01:00Z'));
  render(
    <AmountVisibilityProvider>
      <HideAmounts />
      <LatestRecords
        snapshots={[
          {
            id: '2026-10',
            entries: [
              { category: 'savings', account: 'Example', amount: 1234 },
            ],
          },
        ]}
        salary={[{ id: '2026-10', salary: 4567, bonus: 200 }]}
        expenses={[
          {
            id: 'a',
            date: '2026-10-01',
            amount: 100,
            item: 'Example',
            info: '',
            type: 'other',
            splitType: 'shared',
            splits: [{ person: 'Other', amount: 40, settled: false }],
          },
          {
            id: 'b',
            date: '2026-09-30',
            amount: 900,
            item: 'Example',
            info: '',
            type: 'other',
            splitType: 'self',
            splits: [],
          },
        ]}
        assetsState="ready"
        salaryState="ready"
        expensesState="ready"
        retryAssets={() => {}}
        retrySalary={() => {}}
        retryExpenses={() => {}}
      />
    </AmountVisibilityProvider>
  );
  expect(screen.getByText('$1,234')).toBeTruthy();
  expect(screen.getByText('$4,567')).toBeTruthy();
  expect(screen.getByText('$60')).toBeTruthy();
  expect(screen.queryByText('Est. Annual')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
  expect(screen.queryByText(/\$[0-9]/)).toBeNull();
});

it('does not turn invalid shared allocations into a plausible spending amount', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
  render(
    <LatestRecords
      assetsState="ready"
      salaryState="ready"
      expensesState="ready"
      retryAssets={() => {}}
      retrySalary={() => {}}
      retryExpenses={() => {}}
      expenses={[
        {
          id: 'a',
          date: '2026-10-01',
          amount: 10,
          item: 'Example',
          info: '',
          type: 'other',
          splitType: 'shared',
          splits: [{ person: 'Other', amount: 20, settled: false }],
        },
      ]}
    />
  );
  expect(screen.getByText('Check shared splits')).toBeTruthy();
});
