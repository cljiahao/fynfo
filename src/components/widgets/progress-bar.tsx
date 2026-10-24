import { cn } from '@/lib/utils';

interface ProgressSegment {
  /** 0-100; clamped. */
  pct: number;
  /** Fill class (`fill-*`), or pass `color` for a chart-palette token. */
  className?: string;
  color?: string;
}

interface ProgressBarProps {
  segments: ProgressSegment[];
  className?: string;
}

/**
 * Allocation/progress bar drawn as SVG so runtime percentages need no inline
 * style (constitution 3.2). Decorative: the value is shown as text beside it.
 */
export function ProgressBar({ segments, className }: ProgressBarProps) {
  const rounded = segments.length === 1;
  const placed = segments.reduce<
    { segment: ProgressSegment; x: number; width: number }[]
  >((acc, segment) => {
    const x = acc.reduce((sum, item) => sum + item.width, 0);
    const width = Math.min(100 - x, Math.max(0, segment.pct));
    return [...acc, { segment, x, width }];
  }, []);
  return (
    <svg aria-hidden="true" className={cn('block h-full w-full', className)}>
      {placed.map(({ segment, x, width }, index) => (
        <rect
          key={index}
          x={`${x}%`}
          width={`${width}%`}
          height="100%"
          rx={rounded ? 4 : 0}
          fill={segment.color}
          className={segment.className}
        />
      ))}
    </svg>
  );
}
