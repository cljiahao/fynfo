import { CATEGORY_LABELS } from '@/features/assets';
import { EXPENSE_TYPE_LABELS } from '@/features/expenses';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import {
  SEARCH_EXCERPT_LIMIT,
  SEARCH_SOURCE_LIMIT,
  SEARCH_TERM_LIMIT,
} from '../constants';
import type {
  SearchGroup,
  SearchHistories,
  SearchResult,
  SearchSource,
} from '../types';

function excerpt(value: string): string {
  return value.length > SEARCH_EXCERPT_LIMIT
    ? `${value.slice(0, SEARCH_EXCERPT_LIMIT)}…`
    : value;
}

function collect<T>(
  records: readonly T[],
  matches: (record: T) => boolean,
  project: (record: T, index: number) => SearchResult,
  newestLast = false
): SearchGroup {
  const results: SearchResult[] = [];
  for (let offset = 0; offset < records.length; offset++) {
    const index = newestLast ? records.length - 1 - offset : offset;
    const record = records[index];
    if (!matches(record)) continue;
    if (results.length === SEARCH_SOURCE_LIMIT) return { results, more: true };
    results.push(project(record, index));
  }
  return { results, more: false };
}

export function searchPersonalRecords(
  term: string,
  histories: SearchHistories
): Record<SearchSource, SearchGroup> {
  const query = term.slice(0, SEARCH_TERM_LIMIT).trim().toLowerCase();
  const includes = (...fields: string[]) =>
    fields.some((field) => field.toLowerCase().includes(query));
  const empty = (): SearchGroup => ({ results: [], more: false });
  if (!query)
    return {
      snapshots: empty(),
      salary: empty(),
      expenses: empty(),
      trades: empty(),
      dividends: empty(),
    };
  return {
    snapshots: collect(
      histories.snapshots,
      (record) =>
        includes(record.id) ||
        record.entries.some((entry) =>
          includes(
            entry.account,
            CATEGORY_LABELS[entry.category] ?? entry.category
          )
        ),
      (record, index) => ({
        key: `snapshot-${index}`,
        label: `Snapshot · ${record.id}`,
        context: excerpt(
          record.entries.find((entry) =>
            includes(
              entry.account,
              CATEGORY_LABELS[entry.category] ?? entry.category
            )
          )?.account ?? ''
        ),
        href: `${PAGE_ROUTES.ENTRY}?edit=${encodeURIComponent(record.id)}`,
        action: 'Edit snapshot',
      }),
      true
    ),
    salary: collect(
      histories.salary,
      (record) => includes(record.id),
      (record, index) => ({
        key: `salary-${index}`,
        label: `Salary · ${record.id}`,
        context: 'Recorded month',
        href: PAGE_ROUTES.SALARY,
        action: 'Open Salary',
      }),
      true
    ),
    expenses: collect(
      histories.expenses,
      (record) =>
        includes(
          record.item,
          record.info,
          EXPENSE_TYPE_LABELS[record.type] ?? record.type,
          record.date
        ),
      (record, index) => ({
        key: `expense-${index}`,
        label: excerpt(
          record.item.trim() ||
            (EXPENSE_TYPE_LABELS[record.type] ?? record.type)
        ),
        context: `${record.date.slice(0, 10)} · ${EXPENSE_TYPE_LABELS[record.type] ?? record.type}`,
        href: PAGE_ROUTES.EXPENSES,
        action: 'Open Expenses',
      })
    ),
    trades: collect(
      histories.trades,
      (record) =>
        includes(record.ticker, record.broker, record.action, record.date),
      (record, index) => ({
        key: `trade-${index}`,
        label: excerpt(`${record.ticker} · ${record.action}`),
        context: excerpt(`${record.date.slice(0, 10)} · ${record.broker}`),
        href: PAGE_ROUTES.EQUITY,
        action: 'Open Equity',
      })
    ),
    dividends: collect(
      histories.dividends,
      (record) => includes(record.ticker, record.currency, record.date),
      (record, index) => ({
        key: `distribution-${index}`,
        label: excerpt(`${record.ticker} · ${record.currency}`),
        context: record.date.slice(0, 10),
        href: PAGE_ROUTES.EQUITY,
        action: 'Open Equity',
      })
    ),
  };
}
