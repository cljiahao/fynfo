'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS } from '../constants';
import type { ExpenseType } from '../types';

interface ExpenseTypeSelectProps {
  value: ExpenseType;
  onChange: (type: ExpenseType) => void;
  onSubmit?: () => void;
  onAfterSelect?: () => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  inputId?: string;
  disabled?: boolean;
}

export function ExpenseTypeSelect({
  value,
  onChange,
  onSubmit,
  onAfterSelect,
  onOpenChange,
  className,
  inputClassName,
  inputRef,
  inputId,
  disabled = false,
}: ExpenseTypeSelectProps) {
  const [typeQuery, setTypeQuery] = useState('');
  const [typeEditing, setTypeEditing] = useState(false);
  const [typeOpen, setTypeOpenState] = useState(false);
  const [typeIndex, setTypeIndex] = useState(-1);

  const setTypeOpen = (open: boolean) => {
    setTypeOpenState(open);
    onOpenChange?.(open);
  };

  const filtered = typeQuery
    ? EXPENSE_TYPES.filter((t) =>
        EXPENSE_TYPE_LABELS[t].toLowerCase().includes(typeQuery.toLowerCase())
      )
    : EXPENSE_TYPES;

  const selectType = (t: ExpenseType) => {
    if (disabled) return;
    onChange(t);
    setTypeQuery('');
    setTypeEditing(false);
    setTypeOpen(false);
    onAfterSelect?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setTypeIndex((i) => Math.min(i + 1, filtered.length - 1));
      setTypeOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTypeIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.stopPropagation();
      e.preventDefault();
      if (typeOpen && typeIndex >= 0 && filtered[typeIndex]) {
        selectType(filtered[typeIndex]);
      } else if (filtered.length === 1) {
        selectType(filtered[0]);
      } else {
        onSubmit?.();
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setTypeOpen(false);
      setTypeQuery('');
    } else if (e.key === 'Tab') {
      if (typeEditing && typeQuery && filtered.length > 0) {
        onChange(typeIndex >= 0 ? filtered[typeIndex] : filtered[0]);
        setTypeQuery('');
      }
      setTypeEditing(false);
      setTypeOpen(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Input
        id={inputId}
        ref={inputRef}
        disabled={disabled}
        value={typeEditing ? typeQuery : EXPENSE_TYPE_LABELS[value]}
        onChange={(e) => {
          if (disabled) return;
          setTypeEditing(true);
          setTypeQuery(e.target.value);
          setTypeOpen(true);
          setTypeIndex(0);
        }}
        onFocus={(e) => {
          if (disabled) return;
          setTypeEditing(false);
          setTypeQuery('');
          setTypeOpen(true);
          setTypeIndex(EXPENSE_TYPES.indexOf(value));
          e.target.select();
        }}
        onBlur={() => {
          setTimeout(() => {
            setTypeOpen(false);
            setTypeQuery('');
            setTypeEditing(false);
          }, 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Category"
        className={cn('h-9 w-full', inputClassName)}
      />
      {typeOpen && !disabled && (
        <div className="bg-popover absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border shadow-md">
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.map((t, i) => (
              <button
                key={t}
                type="button"
                className={cn(
                  'flex w-full items-center px-3 py-1.5 text-sm transition-colors',
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
            {filtered.length === 0 && (
              <span className="text-muted-foreground block px-3 py-1.5 text-sm">
                No match
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
