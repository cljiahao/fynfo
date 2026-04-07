'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfile } from '@/features/profile/hooks/use-profile';
import { Banknote, Calculator, Receipt, TrendingUp } from 'lucide-react';
import { calculateTaxSummary, type TaxProfileContext } from '../lib/tax-cpf';
import type { SalaryData } from '../types';

interface SalarySummaryCardsProps {
  records: SalaryData[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function SalarySummaryCards({ records }: SalarySummaryCardsProps) {
  const { data: profile } = useProfile();
  const currentYear = new Date().getFullYear();
  const latest = records[records.length - 1];

  const taxProfile: TaxProfileContext = {
    birthYear: profile?.birthYear ?? null,
    isNsman: profile?.isNsman ?? true,
    residencyStatus: profile?.residencyStatus ?? 'resident',
  };

  const currentYearRecords = records.filter((r) =>
    r.id.startsWith(`${currentYear}-`)
  );
  const monthsRecorded = currentYearRecords.length;
  const ytdSalary = currentYearRecords.reduce((s, r) => s + r.salary, 0);
  const ytdBonus = currentYearRecords.reduce((s, r) => s + r.bonus, 0);

  const estAnnualSalary =
    monthsRecorded > 0 ? (ytdSalary / monthsRecorded) * 12 : 0;
  const estAnnualBonus =
    monthsRecorded > 0 ? (ytdBonus / monthsRecorded) * 12 : 0;
  const estSummary = calculateTaxSummary(
    estAnnualSalary,
    estAnnualBonus,
    currentYear,
    taxProfile
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Current Salary</CardTitle>
          <Banknote className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {latest ? formatCurrency(latest.salary) : '-'}
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
            {formatCurrency(estSummary.grossAnnual)}
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
          <div className="text-2xl font-bold text-red-500">
            {formatCurrency(estSummary.taxPayable)}
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
            {formatCurrency(ytdSalary + ytdBonus)}
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
