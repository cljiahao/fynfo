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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
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
import type { ExpenseData, ExpenseSplitData, ExpenseType } from '../types';
import { SplitDialog } from './split-dialog';

const generateId = () =>
  `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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

const PAGE_SIZES = [10, 25, 50] as const;

type SortKey = 'date' | 'type' | 'item' | 'amount' | 'splitType';
type SortDir = 'asc' | 'desc';

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
  const [typeQuery, setTypeQuery] = useState('');
  const [typeEditing, setTypeEditing] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeIndex, setTypeIndex] = useState(-1);
  const typeRef = useRef<HTMLInputElement>(null);

  const filteredTypes = typeQuery
    ? EXPENSE_TYPES.filter((t) =>
        EXPENSE_TYPE_LABELS[t].toLowerCase().includes(typeQuery.toLowerCase())
      )
    : EXPENSE_TYPES;

  const selectType = (t: ExpenseType) => {
    update({ type: t });
    setTypeQuery('');
    setTypeEditing(false);
    setTypeOpen(false);
  };

  const handleTypeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setTypeIndex((i) => Math.min(i + 1, filteredTypes.length - 1));
      setTypeOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTypeIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (typeOpen && typeIndex >= 0 && filteredTypes[typeIndex]) {
        selectType(filteredTypes[typeIndex]);
      } else if (filteredTypes.length === 1) {
        selectType(filteredTypes[0]);
      } else {
        handleSave();
      }
    } else if (e.key === 'Escape') {
      setTypeOpen(false);
      setTypeQuery('');
    } else if (e.key === 'Tab') {
      if (typeEditing && typeQuery && filteredTypes.length > 0) {
        const selected = typeIndex >= 0 ? filteredTypes[typeIndex] : filteredTypes[0];
        update({ type: selected });
        setTypeQuery('');
      }
      setTypeEditing(false);
      setTypeOpen(false);
    }
  };

  const update = (patch: Partial<ExpenseData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !dateOpen && !typeOpen && !splitDialogOpen) {
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
    update({ splits });
  };

  const handleSave = () => {
    if (!data.date || data.amount <= 0) {
      toast.error('Date and amount are required');
      return;
    }
    onSave({ ...data, id: data.id || generateId() });
  };

  const handleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dateOpenRef.current || splitDialogOpenRef.current) return;
    if (!data.date || data.amount <= 0) {
      if (isNew && onCancel) onCancel();
      return;
    }
    onSave({ ...data, id: data.id || generateId() });
  };

  const splitSummary = data.splits.length > 0
    ? data.splits.map((s) => s.person).join(', ')
    : null;

  return (
    <>
      <tr className={cn('border-b transition-colors hover:bg-muted/40', isNew && 'bg-accent/30')} onKeyDown={handleRowKeyDown} onBlur={handleRowBlur}>
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
          <div className="relative w-full">
            <Input
              ref={typeRef}
              value={typeEditing ? typeQuery : EXPENSE_TYPE_LABELS[data.type]}
              onChange={(e) => {
                setTypeEditing(true);
                setTypeQuery(e.target.value);
                setTypeOpen(true);
                setTypeIndex(0);
              }}
              onFocus={(e) => {
                setTypeEditing(false);
                setTypeQuery('');
                setTypeOpen(true);
                setTypeIndex(EXPENSE_TYPES.indexOf(data.type));
                e.target.select();
              }}
              onBlur={() => {
                setTimeout(() => {
                  setTypeOpen(false);
                  setTypeQuery('');
                  setTypeEditing(false);
                }, 150);
              }}
              onKeyDown={handleTypeKeyDown}
              placeholder="Category"
              className="h-9 w-full text-xs"
            />
            {typeOpen && (
              <div className="bg-popover absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border shadow-md">
                <div className="max-h-48 overflow-y-auto py-1">
                  {filteredTypes.map((t, i) => (
                    <button
                      key={t}
                      type="button"
                      className={cn(
                        'flex w-full items-center px-3 py-1.5 text-xs transition-colors',
                        i === typeIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectType(t);
                      }}
                      onMouseEnter={() => setTypeIndex(i)}
                    >
                      {EXPENSE_TYPE_LABELS[t]}
                    </button>
                  ))}
                  {filteredTypes.length === 0 && (
                    <span className="text-muted-foreground block px-3 py-1.5 text-xs">
                      No match
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
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
            onValueChange={(v) =>
              handleSplitTypeChange(v as 'self' | 'shared')
            }
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
              <span className="truncate">
                {splitSummary || 'Add...'}
              </span>
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
      className="px-2 py-3 text-center cursor-pointer select-none hover:text-foreground"
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
  const filtered = (expenses ?? []).filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (splitFilter !== 'all' && e.splitType !== splitFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.item.toLowerCase().includes(q) ||
        e.info.toLowerCase().includes(q) ||
        EXPENSE_TYPE_LABELS[e.type].toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'date':
        cmp = a.date.localeCompare(b.date);
        break;
      case 'type':
        cmp = EXPENSE_TYPE_LABELS[a.type].localeCompare(EXPENSE_TYPE_LABELS[b.type]);
        break;
      case 'item':
        cmp = a.item.localeCompare(b.item);
        break;
      case 'amount':
        cmp = a.amount - b.amount;
        break;
      case 'splitType':
        cmp = a.splitType.localeCompare(b.splitType);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(Math.ceil(sorted.length / pageSize), 1);
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
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
            <Search className="text-muted-foreground size-4" />
          </div>
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            placeholder="Search item, info, type..."
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
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
        <Select value={splitFilter} onValueChange={(v) => { setSplitFilter(v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[120px] text-xs">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="self">Self</SelectItem>
            <SelectItem value="shared">Shared</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed min-w-[1040px]">
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
              <SortableHeader label="Date" sortKey="date" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Type" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Item" sortKey="item" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th className="px-2 py-3 text-center">Info</th>
              <SortableHeader label="Amount" sortKey="amount" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Split" sortKey="splitType" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
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
                <td
                  colSpan={8}
                  className="text-muted-foreground px-3 py-16 text-center text-sm"
                >
                  {(expenses ?? []).length === 0
                    ? 'No expenses yet. Click "Add Expense" to get started.'
                    : 'No expenses match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex-between text-sm">
          <span className="text-muted-foreground text-xs">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of{' '}
            {sorted.length} expense{sorted.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}
            >
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span>Page</span>
              <input
                key={page}
                type="number"
                defaultValue={page + 1}
                min={1}
                max={totalPages}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const n = parseInt(e.currentTarget.value, 10);
                    if (!isNaN(n)) setPage(Math.max(0, Math.min(n - 1, totalPages - 1)));
                    e.currentTarget.blur();
                  }
                }}
                onBlur={(e) => {
                  const n = parseInt(e.currentTarget.value, 10);
                  if (!isNaN(n)) setPage(Math.max(0, Math.min(n - 1, totalPages - 1)));
                }}
                onFocus={(e) => e.target.select()}
                className="h-8 w-12 rounded-md border text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span>of {totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
