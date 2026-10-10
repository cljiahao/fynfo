'use client';

import { EmptyState, PaginationControls } from '@/components/widgets';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  useDeleteExpense,
  useDistinctPeople,
  useExpenses,
  useUpsertExpense,
} from '../hooks/use-expenses';
import {
  filterExpenses,
  sortExpenses,
  type SortDir,
  type SortKey,
} from '../lib/expense-table';
import { generateId } from '../lib/utils';
import type { ExpenseData } from '../types';
import { EditableRow } from './editable-expense-row';
import { ExpenseTableToolbar } from './expense-table-toolbar';
import { SortableHeader } from './sortable-header';

const EMPTY_ROW: ExpenseData = {
  id: '',
  date: '',
  type: 'food_drink',
  item: '',
  info: '',
  amount: 0,
  splitType: 'self',
  splits: [],
};

export function ExpenseTable() {
  const { data: expenses, isLoading } = useExpenses();
  const { data: people } = useDistinctPeople();
  const upsert = useUpsertExpense();
  const remove = useDeleteExpense();
  const [newRows, setNewRows] = useState<ExpenseData[]>([]);
  const lifetime = useRef({ active: true });
  useEffect(() => {
    const instance = { active: true };
    lifetime.current = instance;
    return () => {
      instance.active = false;
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [splitFilter, setSplitFilter] = useState<string>('all');

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'amount' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  // Changing a filter always resets to the first page.
  const onSearchChange = (v: string) => {
    setSearchQuery(v);
    setPage(0);
  };
  const onTypeChange = (v: string) => {
    setTypeFilter(v);
    setPage(0);
  };
  const onSplitChange = (v: string) => {
    setSplitFilter(v);
    setPage(0);
  };

  const draftIds = new Set(newRows.map((row) => row.id));
  const filtered = filterExpenses(
    (expenses ?? []).filter((row) => !draftIds.has(row.id)),
    {
      searchQuery,
      typeFilter,
      splitFilter,
    }
  );
  const sorted = sortExpenses(filtered, sortKey, sortDir);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const addRow = () => {
    const row = {
      ...EMPTY_ROW,
      id: generateId(),
      date: format(new Date(), 'yyyy-MM-dd'),
    };
    setNewRows((prev) => [...prev, row]);
  };

  const handleSave = async (data: ExpenseData) => {
    const instance = lifetime.current;
    try {
      await upsert.mutateAsync(data);
      if (!instance.active) return;
      setNewRows((prev) => prev.filter((row) => row.id !== data.id));
      toast.success('Expense saved');
    } catch {
      if (instance.active) toast.error('Failed to save expense');
    }
  };

  const handleDelete = async (id: string) => {
    const instance = lifetime.current;
    try {
      await remove.mutateAsync(id);
      if (instance.active) toast.success('Expense deleted');
    } catch {
      if (instance.active) toast.error('Failed to delete');
    }
  };

  const cancelNewRow = (id: string) => {
    setNewRows((prev) => prev.filter((row) => row.id !== id));
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="space-y-3">
      <ExpenseTableToolbar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        typeFilter={typeFilter}
        onTypeChange={onTypeChange}
        splitFilter={splitFilter}
        onSplitChange={onSplitChange}
        onAddRow={addRow}
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1040px] table-fixed">
          <colgroup>
            <col className="w-[155px]" />
            <col className="w-[140px]" />
            <col className="w-[165px]" />
            <col />
            <col className="w-[115px]" />
            <col className="w-[100px]" />
            <col className="w-[100px]" />
            <col className="w-[90px]" />
          </colgroup>
          <thead>
            <tr className="bg-muted/50 border-b text-xs font-semibold tracking-wide">
              <SortableHeader
                label="Date"
                sortKey="date"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Type"
                sortKey="type"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Item"
                sortKey="item"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <th className="px-2 py-3 text-center">Info</th>
              <SortableHeader
                label="Amount"
                sortKey="amount"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Split"
                sortKey="splitType"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <th className="px-2 py-3 text-center">Who?</th>
              <th className="px-2 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {newRows.map((row) => (
              <EditableRow
                key={`new-${row.id}`}
                row={row}
                isNew
                peopleSuggestions={people ?? []}
                onSave={handleSave}
                onDelete={handleDelete}
                onCancel={() => cancelNewRow(row.id)}
              />
            ))}
            {paginated.map((expense) => (
              <EditableRow
                key={expense.id}
                row={{
                  ...expense,
                  date: format(new Date(expense.date), 'yyyy-MM-dd'),
                }}
                isNew={false}
                peopleSuggestions={people ?? []}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
            {filtered.length === 0 && newRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10">
                  {(expenses ?? []).length === 0 ? (
                    <EmptyState
                      icon={Receipt}
                      title="No expenses yet"
                      description='Click "Add Expense" to get started.'
                      className="border-0"
                    />
                  ) : (
                    <p className="text-muted-foreground text-center text-sm">
                      No expenses match your filters.
                    </p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={sorted.length}
          itemLabel="expense"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
