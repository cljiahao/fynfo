'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { format, parseISO } from 'date-fns';
import type { DailyPoint } from '../types';

interface MarketingTrendChartProps {
  daily: DailyPoint[];
}

export function MarketingTrendChart({ daily }: MarketingTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Traffic over time</CardTitle>
        <CardDescription>Daily page views vs CTA clicks</CardDescription>
      </CardHeader>
      <CardContent>
        {daily.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No telemetry yet.
          </p>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <XAxis
                  dataKey="day"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => format(parseISO(v), 'MMM d')}
                  {...CHART_AXIS_TICK_PROPS}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={40}
                  {...CHART_AXIS_TICK_PROPS}
                />
                <Tooltip
                  {...CHART_TOOLTIP_PROPS}
                  labelFormatter={(value) =>
                    format(parseISO(String(value)), 'MMM d, yyyy')
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="pageViews"
                  name="Page views"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ctaClicks"
                  name="CTA clicks"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
