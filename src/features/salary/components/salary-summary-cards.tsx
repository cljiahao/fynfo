'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Current Salary</CardTitle>
          <Banknote className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {latest ? formatSGDWhole(latest.salary) : '-'}
          </div>
          <p className="text-muted-foreground text-xs">
            {latest?.id ?? 'No records'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Est. Annual</CardTitle>
          <TrendingUp className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatSGDWhole(estSummary.grossAnnual)}
          </div>
          <p className="text-muted-foreground text-xs">
            {monthsRecorded > 0
              ? `From ${monthsRecorded} month(s) in ${currentYear}`
              : 'No records'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Est. Tax</CardTitle>
          <Receipt className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-loss text-2xl font-bold">
            {formatSGDWhole(estSummary.taxPayable)}
          </div>
          <p className="text-muted-foreground text-xs">
            {estSummary.grossAnnual > 0
              ? `Effective ${(estSummary.effectiveRate * 100).toFixed(1)}%`
              : 'No records'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">YTD Income</CardTitle>
          <Calculator className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatSGDWhole(ytdSalary + ytdBonus)}
          </div>
          <p className="text-muted-foreground text-xs">
            {currentYearRecords.length > 0
              ? `${currentYearRecords.length} month(s) in ${currentYear}`
              : `No records for ${currentYear}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
