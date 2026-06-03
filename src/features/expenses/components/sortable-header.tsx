'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDir, SortKey } from '../lib/expense-table';

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}

// Clickable sortable column header with directional indicator.
export function SortableHeader({
  label,
  sortKey: col,
  currentKey,
  currentDir,
  onSort,
}: SortableHeaderProps) {
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
