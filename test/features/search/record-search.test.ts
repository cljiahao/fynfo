import { searchPersonalRecords } from '@/features/search/lib/record-search';
import type { SearchHistories } from '@/features/search/types';
import { expect, it } from 'vitest';

const histories: SearchHistories = {
  snapshots: [
    {
      id: '2026-01',
      entries: [
        { category: 'savings', account: 'Synthetic account', amount: 100 },
      ],
    },
  ],
  salary: [{ id: '2026-01', salary: 100, bonus: 0 }],
  expenses: [
    {
      id: 'expense',
      date: '2026-01-02',
      type: 'food_drink',
      item: 'Synthetic meal',
      info: 'Literal [notes]',
      amount: 20,
      splitType: 'shared',
      splits: [{ person: 'Excluded person', amount: 10, settled: false }],
    },
  ],
  trades: [
    {
      date: '2026-01-03',
      ticker: 'DBS',
      broker: 'Synthetic broker',
      action: 'buy',
      shares: 10,
      price: 20,
      fees: 0,
    },
  ],
  dividends: [
    { date: '2026-01-04', ticker: 'DBS', amount: 5, currency: 'USD' },
  ],
};

it('matches native text with honest feature destinations and no invented currency-valued results', () => {
  expect(
    searchPersonalRecords(' account ', histories).snapshots.results[0]
  ).toMatchObject({
    href: '/dashboard/entry?edit=2026-01',
    action: 'Edit snapshot',
  });
  expect(
    searchPersonalRecords('FOOD & DRINK', histories).expenses.results[0]
  ).toMatchObject({ href: '/dashboard/expenses', action: 'Open Expenses' });
  expect(
    searchPersonalRecords('[notes]', histories).expenses.results
  ).toHaveLength(1);
  expect(
    searchPersonalRecords('broker', histories).trades.results[0]
  ).toMatchObject({
    label: 'DBS · buy',
    href: '/dashboard/equity',
    action: 'Open Equity',
  });
  expect(
    searchPersonalRecords('usd', histories).dividends.results[0].label
  ).toBe('DBS · USD');
  expect(
    searchPersonalRecords('2026-01', histories).salary.results[0].action
  ).toBe('Open Salary');
  expect(
    searchPersonalRecords('Savings', histories).snapshots.results
  ).toHaveLength(1);
  expect(searchPersonalRecords('sell', histories).trades.results).toHaveLength(
    0
  );
  expect(
    searchPersonalRecords('Excluded person', histories).expenses.results
  ).toHaveLength(0);
});
it('keeps blank queries empty, bounds terms, treats regex syntax literally and never mutates histories', () => {
  const before = JSON.stringify(histories);
  for (const term of ['', '   ', '.*', '100'])
    expect(
      Object.values(searchPersonalRecords(term, histories)).flatMap(
        (group) => group.results
      )
    ).toHaveLength(0);
  const longTerm = 'a'.repeat(100);
  const long = {
    ...histories,
    expenses: [{ ...histories.expenses[0], item: longTerm }],
  };
  expect(
    searchPersonalRecords(`${longTerm}ignored`, long).expenses.results
  ).toHaveLength(1);
  expect(JSON.stringify(histories)).toBe(before);
});
it('caps every source at four, detects only additional matches and preserves source ordering', () => {
  const many: SearchHistories = {
    snapshots: Array.from({ length: 6 }, (_, index) => ({
      ...histories.snapshots[0],
      id: `2026-0${index + 1}`,
    })),
    salary: Array.from({ length: 6 }, (_, index) => ({
      ...histories.salary[0],
      id: `2026-0${index + 1}`,
    })),
    expenses: Array.from({ length: 6 }, (_, index) => ({
      ...histories.expenses[0],
      id: `expense-${index}`,
      item: `Synthetic ${index}`,
    })),
    trades: Array.from({ length: 6 }, (_, index) => ({
      ...histories.trades[0],
      ticker: `Synthetic ${index}`,
    })),
    dividends: Array.from({ length: 6 }, (_, index) => ({
      ...histories.dividends[0],
      ticker: `Synthetic ${index}`,
    })),
  };
  const groups = searchPersonalRecords('2026', many);
  for (const group of Object.values(groups)) {
    expect(group.results).toHaveLength(4);
    expect(group.more).toBe(true);
  }
  expect(Object.values(groups).flatMap((group) => group.results)).toHaveLength(
    20
  );
  expect(groups.snapshots.results[0].label).toBe('Snapshot · 2026-06');
  expect(groups.salary.results[0].label).toBe('Salary · 2026-06');
  expect(groups.expenses.results[0].label).toBe('Synthetic 0');
  const four = searchPersonalRecords('2026', {
    ...many,
    expenses: many.expenses.slice(0, 4),
  });
  expect(four.expenses.more).toBe(false);
});
it('projects bounded escaped text without exposing searchable notes or split names', () => {
  const rows = {
    ...histories,
    expenses: [
      {
        ...histories.expenses[0],
        item: '<script>' + 'x'.repeat(500),
        info: 'Private searchable note',
      },
    ],
  };
  const result = searchPersonalRecords('searchable', rows).expenses.results[0];
  expect(result.label.length).toBe(161);
  expect(result.label).toContain('<script>');
  expect(JSON.stringify(result)).not.toContain('Private searchable note');
  expect(JSON.stringify(result)).not.toContain('Excluded person');
  const unnamed = searchPersonalRecords('food', {
    ...histories,
    expenses: [{ ...histories.expenses[0], item: '   ' }],
  });
  expect(unnamed.expenses.results[0].label).toBe('Food & Drink');
});

it('keeps legacy category/type text searchable without crashing other sources', () => {
  const legacy = JSON.parse(JSON.stringify(histories)) as SearchHistories;
  Object.assign(legacy.snapshots[0].entries[0], {
    category: 'legacy-category',
  });
  Object.assign(legacy.expenses[0], { type: 'legacy-type', item: '' });
  expect(
    searchPersonalRecords('legacy-category', legacy).snapshots.results
  ).toHaveLength(1);
  expect(
    searchPersonalRecords('legacy-type', legacy).expenses.results[0].label
  ).toBe('legacy-type');
  expect(searchPersonalRecords('broker', legacy).trades.results).toHaveLength(
    1
  );
});
