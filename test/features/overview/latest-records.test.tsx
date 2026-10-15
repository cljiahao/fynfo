// @vitest-environment jsdom
import { PageViews } from '@/components/widgets/page-views';
import { LatestRecords } from '@/features/overview/components/latest-records';
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
      retryExpenses={() => {}}
    />
  );
  expect(screen.getByText('Sept 2026')).toBeTruthy();
  expect(screen.getByText('Oct 2026')).toBeTruthy();
  expect(screen.getByText('23 Sept 2026')).toBeTruthy();
  expect(screen.getAllByText('Earlier than this month')).toHaveLength(1);
  expect(
    screen.getByRole('link', { name: 'Expenses' }).getAttribute('href')
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
      retryExpenses={retry}
    />
  );
  expect(screen.getByText('Loading…')).toBeTruthy();
  expect(screen.getAllByText('No records yet')).toHaveLength(1);
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.queryByText(/Jan 2026/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry expenses' }));
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
