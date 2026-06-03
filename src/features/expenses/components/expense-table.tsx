'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState, PaginationControls } from '@/components/widgets';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarIcon,
  Plus,
  Receipt,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS } from '../constants';
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
import { generateId, resolveSplitConfirm } from '../lib/utils';
import type { ExpenseData, ExpenseSplitData } from '../types';
import { ExpenseTypeSelect } from './expense-type-select';
import { SplitDialog } from './split-dialog';

const EMPTY_ROW: ExpenseData = {
  id: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  type: 'food_drink',
  item: '',
  info: '',
  amount: 0,
  splitType: 'self',
  splits: [],
};

// --- Editable Row ---

interface EditableRowProps {
  row: ExpenseData;
  isNew: boolean;
  peopleSuggestions: string[];
  onSave: (data: ExpenseData) => void;
  onDelete: (id: string) => void;
  onCancel?: () => void;
}

function EditableRow({
  row,
  isNew,
  peopleSuggestions,
  onSave,
  onDelete,
  onCancel,
}: EditableRowProps) {
  const [data, setData] = useState<ExpenseData>(row);
  const [splitDialogOpen, setSplitDialogOpenState] = useState(false);
  const splitDialogOpenRef = useRef(false);
  const setSplitDialogOpen = (open: boolean) => {
    splitDialogOpenRef.current = open;
    setSplitDialogOpenState(open);
  };
  const [dateOpen, setDateOpenState] = useState(false);
  const dateOpenRef = useRef(false);
  const setDateOpen = (open: boolean) => {
    dateOpenRef.current = open;
    setDateOpenState(open);
  };
  const typeOpenRef = useRef(false);
  const splitSelectOpenRef = useRef(false);
  const skipNextBlurRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (patch: Partial<ExpenseData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (
      e.key === 'Enter' &&
      !dateOpen &&
      !typeOpenRef.current &&
      !splitDialogOpen
    ) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape' && isNew && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSplitTypeChange = (splitType: 'self' | 'shared') => {
    if (splitType === 'self') {
      update({ splitType, splits: [] });
    } else {
      update({ splitType });
      setSplitDialogOpen(true);
    }
  };

  const handleSplitConfirm = (splits: ExpenseSplitData[]) => {
    const { next, shouldSave } = resolveSplitConfirm(data, isNew, splits);
    setData(next);
    if (shouldSave) onSave(next);
  };

  const handleSave = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!data.date || data.amount <= 0) {
      toast.error('Date and amount are required');
      return;
    }
    onSave({ ...data, id: data.id || generateId() });
  };

  const handleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (skipNextBlurRef.current) {
      skipNextBlurRef.current = false;
      return;
    }
    if (
      dateOpenRef.current ||
      splitDialogOpenRef.current ||
      splitSelectOpenRef.current
    ) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      return;
    }
    if (!data.date || data.amount <= 0) {
      if (isNew && onCancel) onCancel();
      return;
    }
    const snapshot = { ...data };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      onSave({ ...snapshot, id: snapshot.id || generateId() });
    }, 400);
  };

  const splitSummary =
    data.splits.length > 0 ? data.splits.map((s) => s.person).join(', ') : null;

  return (
    <>
      <tr
        className={cn(
          'hover:bg-muted/40 border-b transition-colors',
          isNew && 'bg-accent/30'
        )}
        onKeyDown={handleRowKeyDown}
        onBlur={handleRowBlur}
      >
        <td className="px-2 py-2">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-9 w-full justify-start gap-2 text-xs font-normal',
                  !data.date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="size-3.5" />
                {data.date
                  ? format(new Date(data.date), 'dd MMM yyyy')
                  : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={data.date ? new Date(data.date) : undefined}
                onSelect={(date) => {
                  if (date) {
                    update({ date: format(date, 'yyyy-MM-dd') });
                    setDateOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </td>
        <td className="px-2 py-2">
          <ExpenseTypeSelect
            value={data.type}
            onChange={(t) => update({ type: t })}
            onSubmit={handleSave}
            onOpenChange={(open) => {
              typeOpenRef.current = open;
            }}
            className="w-full"
            inputClassName="text-xs"
          />
        </td>
        <td className="px-2 py-2">
          <Input
            value={data.item}
            onChange={(e) => update({ item: e.target.value })}
            placeholder="Brand"
            className="h-9 w-full text-xs"
          />
        </td>
        <td className="px-2 py-2">
          <Input
            value={data.info}
            onChange={(e) => update({ info: e.target.value })}
            placeholder="Description"
            className="h-9 w-full text-xs"
          />
        </td>
        <td className="px-2 py-2">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={data.amount || ''}
            onChange={(e) => update({ amount: Number(e.target.value) || 0 })}
            placeholder="0.00"
            className="h-9 w-full text-right text-xs tabular-nums"
          />
        </td>
        <td className="px-2 py-2">
          <Select
            value={data.splitType}
            onValueChange={(v) => handleSplitTypeChange(v as 'self' | 'shared')}
            onOpenChange={(open) => {
              splitSelectOpenRef.current = open;
            }}
          >
            <SelectTrigger className="h-9 w-full px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="self">Self</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-2 py-2">
          {data.splitType === 'shared' ? (
            <button
              type="button"
              className="border-input hover:bg-accent flex h-9 w-full items-center gap-1.5 rounded-md border px-2 text-left text-xs transition-colors"
              onClick={() => setSplitDialogOpen(true)}
            >
              <Users className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{splitSummary || 'Add...'}</span>
            </button>
          ) : (
            <span className="text-muted-foreground block text-center text-xs">
              —
            </span>
          )}
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center justify-center">
            {isNew && onCancel ? (
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={onCancel}
                title="Cancel"
              >
                <X className="size-3.5" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="size-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                onMouseDown={() => {
                  skipNextBlurRef.current = true;
                  if (saveTimerRef.current) {
                    clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = null;
                  }
                }}
                onClick={() => onDelete(data.id)}
                title="Delete"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>

      <SplitDialog
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        totalAmount={data.amount}
        initialSplits={data.splits}
        peopleSuggestions={peopleSuggestions}
        onConfirm={handleSplitConfirm}
      />
    </>
  );
}

// --- Sortable Header ---

function SortableHeader({
  label,
  sortKey: col,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = currentKey === col;
  return (
    <th
      className="hover:text-foreground cursor-pointer px-2 py-3 text-center select-none"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center justify-center gap-1">
        {label}
        {active ? (
          currentDir === 'asc' ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// --- Main Table ---

export function ExpenseTable() {
  const { data: expenses, isLoading } = useExpenses();
  const { data: people } = useDistinctPeople();
  const upsert = useUpsertExpense();
  const remove = useDeleteExpense();
  const [newRows, setNewRows] = useState<ExpenseData[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [splitFilter, setSplitFilter] = useState<string>('all');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
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

  // Filter + sort
  const filtered = filterExpenses(expenses ?? [], {
    searchQuery,
    typeFilter,
    splitFilter,
  });
  const sorted = sortExpenses(filtered, sortKey, sortDir);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const addRow = () => {
    setNewRows((prev) => [...prev, { ...EMPTY_ROW, id: '' }]);
  };

  const handleSave = async (data: ExpenseData) => {
    try {
      await upsert.mutateAsync(data);
      setNewRows([]);
      toast.success('Expense saved');
    } catch {
      toast.error('Failed to save expense');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success('Expense deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const cancelNewRow = (index: number) => {
    setNewRows((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: filters + add button */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs min-w-[180px] flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
            <Search className="text-muted-foreground size-4" />
          </div>
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search item, info, type..."
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EXPENSE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {EXPENSE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={splitFilter}
          onValueChange={(v) => {
            setSplitFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-[120px] text-xs">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="self">Self</SelectItem>
            <SelectItem value="shared">Shared</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={addRow}>
          <Plus className="mr-1 size-4" />
          Add Row
        </Button>
      </div>

      {/* Table */}
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
            {/* New rows always at top */}
            {newRows.map((row, i) => (
              <EditableRow
                key={`new-${i}`}
                row={row}
                isNew
                peopleSuggestions={people ?? []}
                onSave={handleSave}
                onDelete={handleDelete}
                onCancel={() => cancelNewRow(i)}
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
