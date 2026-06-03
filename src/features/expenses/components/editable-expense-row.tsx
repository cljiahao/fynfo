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
import { CalendarIcon, Trash2, Users, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { generateId, resolveSplitConfirm } from '../lib/utils';
import type { ExpenseData, ExpenseSplitData } from '../types';
import { ExpenseTypeSelect } from './expense-type-select';
import { SplitDialog } from './split-dialog';

interface EditableRowProps {
  row: ExpenseData;
  isNew: boolean;
  peopleSuggestions: string[];
  onSave: (data: ExpenseData) => void;
  onDelete: (id: string) => void;
  onCancel?: () => void;
}

// One inline-editable expense row. Owns its local draft + save/blur/split
// state machine; commits via onSave/onDelete callbacks from the table.
export function EditableRow({
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
