'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import dynamic from 'next/dynamic';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants';
import { calculateTotal } from '../lib/calculations';
import type { AssetCategory, SnapshotData } from '../types';

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), {
  ssr: false,
});
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), {
  ssr: false,
});
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), {
  ssr: false,
});
const LabelList = dynamic(() => import('recharts').then((m) => m.LabelList), {
  ssr: false,
});

interface CategoryBreakdownProps {
  snapshot: SnapshotData | undefined;
}

function sumCategory(
  entries: SnapshotData['entries'],
  category: AssetCategory
): number {
  return entries
    .filter((e) => e.category === category)
    .reduce((sum, e) => sum + e.amount, 0);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 0,
  }).format(value);
}

const CPF_ACCOUNTS = ['OA', 'SA', 'MA', 'SRS'] as const;
const CPF_COLORS: Record<string, string> = {
  OA: '#3b82f6',
  SA: '#10b981',
  MA: '#f59e0b',
  SRS: '#8b5cf6',
};

export function CategoryBreakdown({ snapshot }: CategoryBreakdownProps) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Latest Month Breakdown</CardTitle>
          <CardDescription>No data for current month</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const total = calculateTotal(snapshot.entries);

  const pensionEntries = snapshot.entries.filter(
    (e) => e.category === 'pension'
  );
  const cpfData = CPF_ACCOUNTS.map((acc) => {
    const entry = pensionEntries.find((e) => e.account.toUpperCase() === acc);
    return { name: acc, amount: entry?.amount ?? 0 };
  }).filter((d) => d.amount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Month Breakdown</CardTitle>
        <CardDescription>{snapshot.id}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {CATEGORIES.map((cat) => {
          const amount = sumCategory(snapshot.entries, cat);
          const pct = total > 0 ? (amount / total) * 100 : 0;

          return (
            <div key={cat} className="space-y-1">
              <div className="flex-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                  />
                  {CATEGORY_LABELS[cat]}
                </span>
                <span className="font-medium">{formatCurrency(amount)}</span>
              </div>
              <div className="bg-muted h-2 rounded-full">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: CATEGORY_COLORS[cat],
                  }}
                />
              </div>
            </div>
          );
        })}

        {cpfData.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              CPF Breakdown
            </p>
            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cpfData}
                  layout="vertical"
                  margin={{ right: 80 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    formatter={(value: unknown) =>
                      formatCurrency(Number(value))
                    }
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
                    {cpfData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={CPF_COLORS[entry.name] ?? '#6b7280'}
                      />
                    ))}
                    <LabelList
                      dataKey="amount"
                      position="right"
                      fontSize={10}
                      formatter={(v: unknown) => formatCurrency(Number(v))}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
