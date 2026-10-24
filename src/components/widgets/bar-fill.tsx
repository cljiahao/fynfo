import { cn } from '@/lib/utils';

interface BarFillProps {
  /** 0-100; clamped. */
  pct: number;
  /** Fill colour class (`bg-*`), or pass `color` for a chart-palette token. */
  className?: string;
  color?: string;
}

/**
 * Progress/allocation bar segment. Percentage widths are runtime data with no
 * Tailwind class, so this is the one sanctioned inline style (constitution 3.2).
 */
export function BarFill({ pct, className, color }: BarFillProps) {
  const width = `${Math.min(100, Math.max(0, pct))}%`;
  return (
    <div
      className={cn('h-full', className)}
      style={color ? { width, backgroundColor: color } : { width }}
    />
  );
}
