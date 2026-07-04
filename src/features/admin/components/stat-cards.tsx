import { StatCard } from '@/components/widgets';
import { MousePointerClick, TrendingUp, UserPlus, Users } from 'lucide-react';
import type { MarketingTotals } from '../types';

const NUMBER_FORMAT = new Intl.NumberFormat('en-SG');

interface StatCardsProps {
  totals: MarketingTotals;
}

export function StatCards({ totals }: StatCardsProps) {
  const items = [
    {
      label: 'Page views',
      value: NUMBER_FORMAT.format(totals.pageViews),
      icon: Users,
    },
    {
      label: 'CTA clicks',
      value: NUMBER_FORMAT.format(totals.ctaClicks),
      icon: MousePointerClick,
    },
    {
      label: 'Click-through rate',
      value: `${(totals.clickRate * 100).toFixed(1)}%`,
      icon: TrendingUp,
    },
    {
      label: 'Signups',
      value: NUMBER_FORMAT.format(totals.signups),
      icon: UserPlus,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <StatCard
          key={item.label}
          label={item.label}
          value={item.value}
          icon={item.icon}
        />
      ))}
    </div>
  );
}
