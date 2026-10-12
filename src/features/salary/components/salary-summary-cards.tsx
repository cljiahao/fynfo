'use client';

import { useAmountVisibility } from '@/features/privacy';

import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/widgets';
import { formatSGDWhole } from '@/lib/utils/currency';
import { Banknote, Calculator, Receipt, TrendingUp } from 'lucide-react';
import { useSalaryYtdStats } from '../hooks/use-salary-ytd-stats';
import type { SalaryData } from '../types';

interface SalarySummaryCardsProps {
  records: SalaryData[];
}

function formatIncome(value: number): string {
  return Number.isFinite(value) ? formatSGDWhole(value) : '—';
}

export function SalarySummaryCards({ records }: SalarySummaryCardsProps) {
  const { mask } = useAmountVisibility();
  const latest = records[records.length - 1];
  const {
    currentYear,
    currentYearRecords,
    monthsRecorded,
    ytdSalary,
    ytdBonus,
    estSummary,
    profileState,
    reliefState,
    retryReliefs,
  } = useSalaryYtdStats(records);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Current Salary"
        value={mask(latest ? formatIncome(latest.salary) : '-')}
        icon={Banknote}
        hint={latest?.id ?? 'No records'}
      />
      <StatCard
        label="Est. Annual"
        value={mask(
          formatIncome(
            monthsRecorded > 0
              ? ((ytdSalary + ytdBonus) / monthsRecorded) * 12
              : 0
          )
        )}
        icon={TrendingUp}
        hint={
          monthsRecorded > 0
            ? `From ${monthsRecorded} month(s) in ${currentYear}`
            : 'No records'
        }
      />
      <StatCard
        label="Est. Tax"
        value={
          profileState === 'ready' && estSummary !== null
            ? mask(formatIncome(estSummary.taxPayable))
            : '—'
        }
        icon={Receipt}
        tone="loss"
        hint={
          profileState === 'loading'
            ? 'Loading tax profile'
            : profileState === 'error'
              ? 'Tax profile unavailable'
              : profileState === 'incomplete'
                ? 'Complete your profile for tax estimates'
                : reliefState === 'loading'
                  ? 'Loading saved tax reliefs'
                  : reliefState === 'error'
                    ? 'Saved tax reliefs unavailable'
                    : estSummary === null
                      ? 'CPF estimate unavailable'
                      : estSummary.grossAnnual > 0
                        ? mask(
                            `Effective ${(estSummary.effectiveRate * 100).toFixed(1)}%`
                          )
                        : 'No records'
        }
      >
        {profileState === 'ready' && reliefState === 'error' && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={retryReliefs}
          >
            Retry tax reliefs
          </Button>
        )}
      </StatCard>
      <StatCard
        label="YTD Income"
        value={mask(formatIncome(ytdSalary + ytdBonus))}
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
