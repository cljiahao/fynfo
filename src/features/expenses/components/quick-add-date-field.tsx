'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAmountVisibility } from '@/features/privacy';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

export function QuickAddDateField({
  controlId,
  date,
  open,
  frozen,
  invalid,
  isReuse,
  reuseDateInvalid,
  onOpenChange,
  onPick,
}: {
  controlId: string;
  date: string;
  open: boolean;
  frozen: boolean;
  invalid: boolean;
  isReuse: boolean;
  reuseDateInvalid: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (isoDate: string) => void;
}) {
  const { hidden, canReveal } = useAmountVisibility();
  return (
    <div className="space-y-1">
      <label
        htmlFor={controlId + '-date'}
        className="text-muted-foreground block text-xs font-medium"
      >
        Date
      </label>
      <Popover
        open={open && !hidden && !frozen}
        onOpenChange={(next) => {
          if (canReveal() && !frozen) onOpenChange(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={controlId + '-date'}
            disabled={hidden || frozen}
            aria-invalid={invalid || undefined}
            aria-describedby={
              invalid
                ? isReuse
                  ? controlId + '-reuse-date'
                  : controlId
                : undefined
            }
            variant="outline"
            className={cn(
              'bg-background h-9 w-[140px] justify-start gap-2 text-sm font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="size-3.5" />
            {date ? format(new Date(date), 'dd MMM yyyy') : 'Pick date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            defaultMonth={date ? new Date(date) : undefined}
            selected={date ? new Date(date) : undefined}
            onSelect={(picked) => {
              if (picked) onPick(format(picked, 'yyyy-MM-dd'));
            }}
            initialFocus
          />
          <div className="border-border border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onPick(format(new Date(), 'yyyy-MM-dd'))}
            >
              Today
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {reuseDateInvalid && (
        <p id={controlId + '-reuse-date'} className="text-loss-strong text-xs">
          Choose a valid date.
        </p>
      )}
    </div>
  );
}
