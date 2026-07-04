'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/widgets';
import {
  CHART_AXIS_TICK_PROPS,
  CHART_TOOLTIP_PROPS,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/lib/recharts';
import { formatSGDWhole } from '@/lib/utils/currency';
import { Filter, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants';
import type { AssetCategory, ChartDataPoint } from '../types';

interface AssetLineChartProps {
  data: ChartDataPoint[];
}

type LineKey = AssetCategory | 'total' | 'excl_pension' | 'total_investment';

const AGGREGATE_LINES: {
  key: LineKey;
  label: string;
  color: string;
  strokeWidth: number;
}[] = [
  {
    key: 'total',
    label: 'Total Assets',
    color: 'var(--foreground)',
    strokeWidth: 3,
  },
  {
    key: 'excl_pension',
    label: 'Excl. Pension',
    color: 'var(--muted-foreground)',
    strokeWidth: 2.5,
  },
  {
    key: 'total_investment',
    label: 'Total Investment',
    color: 'var(--chart-1)',
    strokeWidth: 2.5,
  },
];

const ALL_LINES: { key: LineKey; label: string; color: string }[] = [
  ...AGGREGATE_LINES.map((l) => ({
    key: l.key,
    label: l.label,
    color: l.color,
  })),
  ...CATEGORIES.map((cat) => ({
    key: cat as LineKey,
    label: CATEGORY_LABELS[cat],
    color: CATEGORY_COLORS[cat],
  })),
];

const ALL_LABELS: Record<string, string> = Object.fromEntries(
  ALL_LINES.map((l) => [l.key, l.label])
);

export function AssetLineChart({ data }: AssetLineChartProps) {
  const [visible, setVisible] = useState<Set<LineKey>>(
    () => new Set(ALL_LINES.map((l) => l.key))
  );

  function toggle(key: LineKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Trends</CardTitle>
          <CardDescription>
            Monthly asset values over time by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={TrendingUp}
            title="No data yet"
            description="Add your first monthly snapshot to see trends."
            className="h-[300px] border-0"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Asset Trends</CardTitle>
            <CardDescription>
              Monthly asset values over time by category
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 size-4" />
                Filter ({visible.size}/{ALL_LINES.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Aggregates</DropdownMenuLabel>
              {AGGREGATE_LINES.map((line) => (
                <DropdownMenuCheckboxItem
                  key={line.key}
                  checked={visible.has(line.key)}
                  onCheckedChange={() => toggle(line.key)}
                  onSelect={(e) => e.preventDefault()}
                >
                  <span
                    aria-hidden="true"
                    className="mr-2 inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: line.color }}
                  />
                  {line.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Categories</DropdownMenuLabel>
              {CATEGORIES.map((cat) => (
                <DropdownMenuCheckboxItem
                  key={cat}
                  checked={visible.has(cat)}
                  onCheckedChange={() => toggle(cat)}
                  onSelect={(e) => e.preventDefault()}
                >
                  <span
                    aria-hidden="true"
                    className="mr-2 inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                  />
                  {CATEGORY_LABELS[cat]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-full min-h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis
                dataKey="month"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                {...CHART_AXIS_TICK_PROPS}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatSGDWhole(v)}
                {...CHART_AXIS_TICK_PROPS}
              />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [
                  formatSGDWhole(Number(value)),
                  ALL_LABELS[String(name)] ?? String(name),
                ]}
                position={{ y: -150 }}
                offset={20}
                {...CHART_TOOLTIP_PROPS}
              />
              <Legend
                formatter={(value: string) => ALL_LABELS[value] ?? value}
              />
              {/* Aggregate lines */}
              {AGGREGATE_LINES.map((line) =>
                visible.has(line.key) ? (
                  <Line
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    stroke={line.color}
                    strokeWidth={line.strokeWidth}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ) : null
              )}
              {/* Individual category lines */}
              {CATEGORIES.map((cat) =>
                visible.has(cat) ? (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stroke={CATEGORY_COLORS[cat]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
