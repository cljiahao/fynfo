'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZES = [10, 25, 50] as const;

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function PaginationControls({
  page,
  pageSize,
  total,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const plural = total !== 1 ? 's' : '';

  return (
    <div className="flex-between text-sm">
      <span className="text-muted-foreground text-xs">
        Showing {from}–{to} of {total} {itemLabel}
        {plural}
      </span>
      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            onPageSizeChange(Number(v));
            onPageChange(0);
          }}
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
                if (!isNaN(n))
                  onPageChange(Math.max(0, Math.min(n - 1, totalPages - 1)));
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              const n = parseInt(e.currentTarget.value, 10);
              if (!isNaN(n))
                onPageChange(Math.max(0, Math.min(n - 1, totalPages - 1)));
            }}
            onFocus={(e) => e.target.select()}
            className="h-8 w-12 [appearance:textfield] rounded-md border text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span>of {totalPages}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
