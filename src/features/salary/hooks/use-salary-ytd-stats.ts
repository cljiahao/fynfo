import { useProfile } from '@/features/profile/hooks/use-profile';
import { estimateRecordedCpf } from '../lib/cpf-estimate';
import {
  calculateTaxSummary,
  type TaxProfileContext,
  type TaxSummary,
} from '../lib/tax-cpf';
import type { SalaryData } from '../types';

export interface SalaryYtdStats {
  profileState: 'loading' | 'error' | 'incomplete' | 'ready';
  retryProfile: () => void;
  currentYear: number;
  taxProfile: TaxProfileContext;
  currentYearRecords: SalaryData[];
  monthsRecorded: number;
  ytdSalary: number;
  ytdBonus: number;
  estAnnualSalary: number;
  estAnnualBonus: number;
  estSummary: TaxSummary | null;
  trueSummary: TaxSummary | null;
}

export function useSalaryYtdStats(
  records: SalaryData[],
  additionalReliefsTotal = 0
): SalaryYtdStats {
  const { data: profile, isPending, isError, refetch } = useProfile();
  const profileState = isPending
    ? 'loading'
    : isError
      ? 'error'
      : profile?.birthYear == null
        ? 'incomplete'
        : 'ready';
  const currentYear = new Date().getFullYear();

  const taxProfile: TaxProfileContext = {
    birthYear: profile?.birthYear ?? null,
    isNsman: profile?.isNsman ?? false,
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

  const recordedCpf = estimateRecordedCpf(currentYearRecords, currentYear);
  const estSummary =
    recordedCpf === null
      ? null
      : calculateTaxSummary(
          estAnnualSalary,
          estAnnualBonus,
          currentYear,
          taxProfile,
          additionalReliefsTotal
        );
  const trueSummary =
    recordedCpf === null
      ? null
      : calculateTaxSummary(
          ytdSalary,
          ytdBonus,
          currentYear,
          taxProfile,
          additionalReliefsTotal,
          recordedCpf
        );

  return {
    profileState,
    retryProfile: () => {
      void refetch();
    },
    currentYear,
    taxProfile,
    currentYearRecords,
    monthsRecorded,
    ytdSalary,
    ytdBonus,
    estAnnualSalary,
    estAnnualBonus,
    estSummary,
    trueSummary,
  };
}
