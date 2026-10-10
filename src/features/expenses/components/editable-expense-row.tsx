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
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSplitAllocationError } from '../lib/split-amounts';
import { generateId, resolveSplitConfirm } from '../lib/utils';
import type { ExpenseData, ExpenseSplitData } from '../types';
import { ExpenseTypeSelect } from './expense-type-select';
import { SplitDialog } from './split-dialog';

interface EditableRowProps {
  row: ExpenseData;
  isNew: boolean;
  peopleSuggestions: string[];
  onSave: (data: ExpenseData) => void | Promise<void>;
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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const lifetime = useRef({ active: true });
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
  const [splitSelectOpen, setSplitSelectOpenState] = useState(false);
  const splitSelectOpenRef = useRef(false);
  const setSplitSelectOpen = (open: boolean) => {
    splitSelectOpenRef.current = open;
    setSplitSelectOpenState(open);
  };
  const skipNextBlurRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const instance = { active: true };
    lifetime.current = instance;
    return () => {
      instance.active = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const update = (patch: Partial<ExpenseData>) => {
    if (savingRef.current) return;
    setData((prev) => ({ ...prev, ...patch }));
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (savingRef.current) {
      if (e.key === 'Enter' || e.key === 'Escape') e.preventDefault();
      return;
    }
    if (
      e.key === 'Enter' &&
      !dateOpenRef.current &&
      !typeOpenRef.current &&
      !splitSelectOpenRef.current &&
      !splitDialogOpenRef.current
    ) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape' && isNew && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSplitTypeChange = (splitType: 'self' | 'shared') => {
    if (savingRef.current) return;
    if (splitType === 'self') {
      update({ splitType, splits: [] });
    } else {
      update({ splitType });
      setSplitDialogOpen(true);
    }
  };

  const handleSplitConfirm = (splits: ExpenseSplitData[]) => {
    if (savingRef.current) return;
    const { next, shouldSave } = resolveSplitConfirm(data, isNew, splits);
    setData(next);
    if (shouldSave) onSave(next);
  };

  const saveDraft = async (draft: ExpenseData) => {
    if (savingRef.current) return;
    const instance = lifetime.current;
    const error =
      draft.splitType === 'shared'
        ? getSplitAllocationError(draft.amount, draft.splits)
        : null;
    if (error) {
      toast.error(error);
      return;
    }
    if (isNew) {
      savingRef.current = true;
      setSaving(true);
      setDateOpen(false);
      setSplitSelectOpen(false);
      setSplitDialogOpen(false);
    }
    try {
      await onSave({ ...draft, id: draft.id || generateId() });
    } catch {
      return;
    } finally {
      if (isNew && instance.active) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  const handleSave = () => {
    if (savingRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!data.date || data.amount <= 0) {
      toast.error('Date and amount are required');
      return;
    }
    saveDraft(data);
  };

  const handleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (savingRef.current) return;
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
      saveDraft(snapshot);
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
        aria-busy={saving || undefined}
        onKeyDown={handleRowKeyDown}
        onBlur={handleRowBlur}
      >
        <td className="px-2 py-2">
          <Popover
            open={dateOpen && !saving}
            onOpenChange={(open) => {
              if (!savingRef.current) setDateOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={saving}
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
                defaultMonth={data.date ? new Date(data.date) : undefined}
                selected={data.date ? new Date(data.date) : undefined}
                onSelect={(date) => {
                  if (date) {
                    update({ date: format(date, 'yyyy-MM-dd') });
                    setDateOpen(false);
                  }
                }}
                initialFocus
              />
              <div className="border-border border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    update({ date: format(new Date(), 'yyyy-MM-dd') });
                    setDateOpen(false);
                  }}
                >
                  Today
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </td>
        <td className="px-2 py-2">
          <ExpenseTypeSelect
            value={data.type}
            disabled={saving}
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
            disabled={saving}
            onChange={(e) => update({ item: e.target.value })}
            placeholder="Brand"
            className="h-9 w-full text-xs"
          />
        </td>
        <td className="px-2 py-2">
          <Input
            value={data.info}
            disabled={saving}
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
            disabled={saving}
            onChange={(e) => update({ amount: Number(e.target.value) || 0 })}
            placeholder="0.00"
            className="h-9 w-full text-right text-xs tabular-nums"
          />
        </td>
        <td className="px-2 py-2">
          <Select
            open={splitSelectOpen && !saving}
            value={data.splitType}
            onValueChange={(v) => handleSplitTypeChange(v as 'self' | 'shared')}
            onOpenChange={(open) => {
              if (!savingRef.current) setSplitSelectOpen(open);
            }}
          >
            <SelectTrigger
              disabled={saving}
              className="h-9 w-full px-2 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent onKeyDown={(event) => event.stopPropagation()}>
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
              disabled={saving}
              onClick={() => {
                if (!savingRef.current) setSplitDialogOpen(true);
              }}
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
                className={saving ? 'h-8 px-2' : 'size-8'}
                disabled={saving}
                onClick={onCancel}
                title={saving ? 'Saving expense' : 'Cancel'}
                aria-label={saving ? 'Saving expense' : 'Cancel edit'}
              >
                {saving ? (
                  <span className="text-xs">Saving…</span>
                ) : (
                  <X className="size-3.5" />
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive size-8"
                onMouseDown={() => {
                  skipNextBlurRef.current = true;
                  if (saveTimerRef.current) {
                    clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = null;
                  }
                }}
                onClick={() => onDelete(data.id)}
                title="Delete"
                aria-label="Delete expense"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>

      <SplitDialog
        open={splitDialogOpen && !saving}
        onOpenChange={(open) => {
          if (!savingRef.current) setSplitDialogOpen(open);
        }}
        totalAmount={data.amount}
        initialSplits={data.splits}
        peopleSuggestions={peopleSuggestions}
        onConfirm={handleSplitConfirm}
      />
    </>
  );
}
