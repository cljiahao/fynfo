'use client';

import { StatCard } from '@/components/widgets';
import { formatSGDWhole } from '@/lib/utils/currency';
import { Banknote, Calculator, Receipt, TrendingUp } from 'lucide-react';
import { useSalaryYtdStats } from '../hooks/use-salary-ytd-stats';
import type { SalaryData } from '../types';

interface SalarySummaryCardsProps {
  records: SalaryData[];
}

export function SalarySummaryCards({ records }: SalarySummaryCardsProps) {
  const latest = records[records.length - 1];
  const {
    currentYear,
    currentYearRecords,
    monthsRecorded,
    ytdSalary,
    ytdBonus,
    estSummary,
  } = useSalaryYtdStats(records);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Current Salary"
        value={latest ? formatSGDWhole(latest.salary) : '-'}
        icon={Banknote}
        hint={latest?.id ?? 'No records'}
      />
      <StatCard
        label="Est. Annual"
        value={formatSGDWhole(estSummary.grossAnnual)}
        icon={TrendingUp}
        hint={
          monthsRecorded > 0
            ? `From ${monthsRecorded} month(s) in ${currentYear}`
            : 'No records'
        }
      />
      <StatCard
        label="Est. Tax"
        value={formatSGDWhole(estSummary.taxPayable)}
        icon={Receipt}
        tone="loss"
        hint={
          estSummary.grossAnnual > 0
            ? `Effective ${(estSummary.effectiveRate * 100).toFixed(1)}%`
            : 'No records'
        }
      />
      <StatCard
        label="YTD Income"
        value={formatSGDWhole(ytdSalary + ytdBonus)}
        icon={Calculator}
        hint={
          currentYearRecords.length > 0
            ? `${currentYearRecords.length} month(s) in ${currentYear}`
            : `No records for ${currentYear}`
        }
      />
    </div>
  );
}
