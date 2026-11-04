'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils/index';
import { useId, useMemo, useState } from 'react';
import type { Market } from '../lib/ticker-market';

export interface TickerOption {
  ticker: string;
  market: Market;
}

export interface TickerSelection {
  ticker: string;
  market?: Market;
}

interface TickerComboboxProps {
  id: string;
  options: TickerOption[];
  value: TickerSelection;
  onChange: (value: TickerSelection) => void;
  disabled?: boolean;
  error?: string;
}

const ADD_NEW = 'Add new ticker';

export function TickerCombobox({
  id,
  options,
  value,
  onChange,
  disabled,
  error,
}: TickerComboboxProps) {
  const listId = useId();
  const [query, setQuery] = useState(value.ticker);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  // A committed selection must not hide the other tickers when reopened.
  const [filtering, setFiltering] = useState(false);

  // Mirror external value changes (e.g. form reset) into the visible text. An
  // empty value mid-typing must not wipe the filter text.
  const [syncedTicker, setSyncedTicker] = useState(value.ticker);
  if (syncedTicker !== value.ticker) {
    setSyncedTicker(value.ticker);
    if (!adding && value.ticker) setQuery(value.ticker);
  }

  const filtered = useMemo(() => {
    const needle = filtering ? query.trim().toUpperCase() : '';
    const matches = needle
      ? options.filter((o) => o.ticker.includes(needle))
      : options;
    return matches;
  }, [options, query, filtering]);

  // The "Add new ticker" row always trails the matches.
  const rowCount = filtered.length + 1;
  const activeRow = Math.min(active, rowCount - 1);
  const optionId = (index: number) => `${listId}-opt-${index}`;

  function chooseExisting(option: TickerOption) {
    setAdding(false);
    setFiltering(false);
    setQuery(option.ticker);
    setOpen(false);
    onChange({ ticker: option.ticker, market: option.market });
  }

  function chooseAdd() {
    setAdding(true);
    setFiltering(false);
    setQuery('');
    setOpen(false);
    onChange({ ticker: '', market: undefined });
  }

  function chooseRow(index: number) {
    if (index < filtered.length) chooseExisting(filtered[index]);
    else chooseAdd();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive(Math.min(activeRow + 1, rowCount - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive(Math.max(activeRow - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      chooseRow(activeRow);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="space-y-2">
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            id={id}
            role="combobox"
            aria-expanded={open && !disabled}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && !disabled ? optionId(activeRow) : undefined
            }
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            placeholder="Search or add a ticker"
            disabled={disabled}
            value={disabled ? '' : query}
            onClick={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            onChange={(event) => {
              const next = event.target.value;
              setAdding(false);
              setFiltering(true);
              setQuery(next);
              setActive(0);
              setOpen(true);
              // Free-typed text is only a filter until an option is chosen.
              if (value.ticker) onChange({ ticker: '', market: undefined });
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (event.target instanceof Element && event.target.id === id) {
              event.preventDefault();
            }
          }}
        >
          <ul
            id={listId}
            role="listbox"
            aria-label="Tickers"
            className="max-h-56 overflow-y-auto"
          >
            {filtered.map((option, index) => (
              <li
                key={option.ticker}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeRow}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm',
                  index === activeRow && 'bg-accent text-accent-foreground'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => chooseExisting(option)}
              >
                <span>{option.ticker}</span>
                <span className="text-muted-foreground text-xs">
                  {option.market}
                </span>
              </li>
            ))}
            <li
              id={optionId(filtered.length)}
              role="option"
              aria-selected={filtered.length === activeRow}
              className={cn(
                'cursor-pointer rounded-sm px-2 py-1.5 text-sm font-medium',
                filtered.length === activeRow &&
                  'bg-accent text-accent-foreground'
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(filtered.length)}
              onClick={chooseAdd}
            >
              {ADD_NEW}
            </li>
          </ul>
        </PopoverContent>
      </Popover>

      {adding && !disabled && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-new`}>New ticker</Label>
            <Input
              id={`${id}-new`}
              placeholder="e.g. AAPL"
              maxLength={16}
              autoComplete="off"
              value={value.ticker}
              onChange={(event) =>
                onChange({
                  ticker: event.target.value.toUpperCase(),
                  market: value.market,
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-market`}>Market</Label>
            <Select
              value={value.market ?? ''}
              onValueChange={(next) => {
                if (next === 'SG' || next === 'US') {
                  onChange({ ticker: value.ticker, market: next });
                }
              }}
            >
              <SelectTrigger id={`${id}-market`} className="w-full">
                <SelectValue placeholder="Select market" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SG">SG</SelectItem>
                <SelectItem value="US">US</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
