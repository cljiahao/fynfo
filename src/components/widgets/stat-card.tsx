import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'gain' | 'loss';
  trend?: 'up' | 'down';
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: '',
  gain: 'text-gain',
  loss: 'text-loss',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  trend,
  hint,
  children,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {trend ? (
          trend === 'up' ? (
            <ArrowUp className="text-gain size-4" />
          ) : (
            <ArrowDown className="text-loss size-4" />
          )
        ) : Icon ? (
          <span className="bg-brand-subtle text-brand flex size-7 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <div
          className={cn('text-2xl font-bold tabular-nums', TONE_CLASS[tone])}
        >
          {value}
        </div>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
        {children}
      </CardContent>
    </Card>
  );
}
