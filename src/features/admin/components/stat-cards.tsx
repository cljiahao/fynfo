import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MarketingTotals } from '../types';

const NUMBER_FORMAT = new Intl.NumberFormat('en-SG');

interface StatCardsProps {
  totals: MarketingTotals;
}

export function StatCards({ totals }: StatCardsProps) {
  const items = [
    { label: 'Page views', value: NUMBER_FORMAT.format(totals.pageViews) },
    { label: 'CTA clicks', value: NUMBER_FORMAT.format(totals.ctaClicks) },
    {
      label: 'Click-through rate',
      value: `${(totals.clickRate * 100).toFixed(1)}%`,
    },
    { label: 'Signups', value: NUMBER_FORMAT.format(totals.signups) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
