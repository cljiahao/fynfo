'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  useId,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from 'react';
import { CATEGORY_MAX_LENGTH, USE_NEW_CATEGORY_LABEL } from '../constants';
import { normalizeCategory, type CategoryOption } from '../lib/spending-stats';

interface Row {
  label: string;
  isNew: boolean;
  budgeted: boolean;
}

/**
 * Category combobox: budgeted categories first, then previously used ones, and
 * a "Use new category" row so a brand-new category is still allowed.
 */
export function CategoryPicker({
  id,
  value,
  options,
  onValueChange,
  ...inputProps
}: {
  id: string;
  value: string;
  options: CategoryOption[];
  onValueChange: (value: string) => void;
} & Omit<
  ComponentProps<typeof Input>,
  'id' | 'value' | 'onChange' | 'role' | 'list'
>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const typed = normalizeCategory(value);
  const matches: Row[] = options
    .filter((option) => normalizeCategory(option.label).includes(typed))
    .map((option) => ({ ...option, isNew: false }));
  const exact = options.some(
    (option) => normalizeCategory(option.label) === typed
  );
  const rows: Row[] =
    typed && !exact
      ? [...matches, { label: value.trim(), isNew: true, budgeted: false }]
      : matches;
  const visible = open && !inputProps.disabled && rows.length > 0;

  function choose(row: Row) {
    onValueChange(row.label);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + rows.length) % rows.length);
      return;
    }
    if (event.key === 'Enter' && visible && active >= 0) {
      event.preventDefault();
      choose(rows[active]);
    }
  }

  return (
    <div className="relative">
      <Input
        {...inputProps}
        id={id}
        role="combobox"
        autoComplete="off"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          visible && active >= 0 ? `${listId}-${active}` : undefined
        }
        maxLength={CATEGORY_MAX_LENGTH}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul
        id={listId}
        role="listbox"
        hidden={!visible}
        className="bg-popover text-popover-foreground absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border p-1 text-sm shadow-md"
      >
        {visible &&
          rows.map((row, index) => (
            <li
              key={`${row.isNew ? 'new' : 'existing'}-${row.label}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5',
                index === active && 'bg-accent'
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(row)}
            >
              <span className="truncate">
                {row.isNew
                  ? `${USE_NEW_CATEGORY_LABEL}: ${row.label}`
                  : row.label}
              </span>
              {row.budgeted && (
                <span className="text-muted-foreground shrink-0 text-xs">
                  Budgeted
                </span>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}
