'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSnapshots } from '@/features/assets';
import { useDividends, useTrades } from '@/features/equity';
import { useExpenses } from '@/features/expenses';
import { useSalaryRecords } from '@/features/salary';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SEARCH_SOURCES, SEARCH_TERM_LIMIT } from '../constants';
import { searchPersonalRecords } from '../lib/record-search';
import type { RecordSearchTaskProps } from '../types';
export function RecordSearchTask({ onSelect }: RecordSearchTaskProps) {
  const snapshots = useSnapshots();
  const salary = useSalaryRecords();
  const expenses = useExpenses();
  const trades = useTrades();
  const dividends = useDividends();
  const [term, setTerm] = useState('');
  const normalized = term.trim();
  const sources = { snapshots, salary, expenses, trades, dividends };
  const groups = useMemo(
    () =>
      searchPersonalRecords(term, {
        snapshots: snapshots.data ?? [],
        salary: salary.data ?? [],
        expenses: expenses.data ?? [],
        trades: trades.data ?? [],
        dividends: dividends.data ?? [],
      }),
    [
      term,
      snapshots.data,
      salary.data,
      expenses.data,
      trades.data,
      dividends.data,
    ]
  );
  const incomplete = Object.values(sources).some(
    (query) => !query.isSuccess || query.isFetching
  );
  const noMatches = SEARCH_SOURCES.every(
    ({ key }) => groups[key].results.length === 0
  );

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="record-search-term">Search your records</Label>
        <Input
          id="record-search-term"
          autoFocus
          value={term}
          maxLength={SEARCH_TERM_LIMIT}
          onChange={(event) =>
            setTerm(event.target.value.slice(0, SEARCH_TERM_LIMIT))
          }
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {normalized
          ? 'Showing up to 4 matches per source. Refine your search for more.'
          : 'Try an account, category, ticker or recorded date.'}
      </p>
      {incomplete && (
        <p role="status" className="text-muted-foreground text-sm">
          Results are partial while sources load, update or need retry.
        </p>
      )}
      {normalized && !incomplete && noMatches && (
        <p role="status">No matches in the loaded personal histories.</p>
      )}
      <div className="space-y-4">
        {SEARCH_SOURCES.map(({ key, label }) => {
          const query = sources[key];
          const group = groups[key];
          return (
            <section
              key={key}
              aria-label={`${label} search`}
              className="space-y-2"
            >
              <h3 className="font-medium">{label}</h3>
              {query.isError ? (
                <div role="alert" className="space-y-2 text-sm">
                  <p>Couldn&apos;t load {label.toLowerCase()}.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void query.refetch()}
                  >
                    Retry {label.toLowerCase()}
                  </Button>
                </div>
              ) : query.isPending ? (
                <p role="status" className="text-muted-foreground text-sm">
                  Loading {label.toLowerCase()}…
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground text-xs">
                    {query.isFetching ? 'Updating cached records · ' : ''}
                    {query.data?.length ?? 0}{' '}
                    {query.data?.length === 1 ? 'record' : 'records'} loaded
                  </p>
                  {!!normalized && (
                    <ul className="space-y-2">
                      {group.results.map((result) => (
                        <li
                          key={result.key}
                          className="min-w-0 border-b pb-2 last:border-0"
                        >
                          <p className="text-sm font-medium [overflow-wrap:anywhere]">
                            {result.label}
                          </p>
                          {result.context && (
                            <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
                              {result.context}
                            </p>
                          )}
                          <Link
                            className="text-sm underline underline-offset-4"
                            href={result.href}
                            onClick={onSelect}
                          >
                            {result.action}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!!normalized && group.more && (
                    <p className="text-muted-foreground text-xs">
                      More matches; refine search.
                    </p>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
