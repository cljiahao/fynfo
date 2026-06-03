'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { EXPENSE_TYPE_LABELS, EXPENSE_TYPES } from '../constants';

interface ExpenseTableToolbarProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeChange: (v: string) => void;
  splitFilter: string;
  onSplitChange: (v: string) => void;
  onAddRow: () => void;
}

// Search + type/split filters + add-row button. Presentational; the table owns
// the filter state and resets pagination on change.
export function ExpenseTableToolbar({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeChange,
  splitFilter,
  onSplitChange,
  onAddRow,
}: ExpenseTableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-xs min-w-[180px] flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
          <Search className="text-muted-foreground size-4" />
        </div>
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search item, info, type..."
          className="h-9 pl-8 text-sm"
        />
      </div>
      <Select value={typeFilter} onValueChange={onTypeChange}>
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
      <Select value={splitFilter} onValueChange={onSplitChange}>
        <SelectTrigger className="h-9 w-[120px] text-xs">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="self">Self</SelectItem>
          <SelectItem value="shared">Shared</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" onClick={onAddRow}>
        <Plus className="mr-1 size-4" />
        Add Row
      </Button>
    </div>
  );
}
