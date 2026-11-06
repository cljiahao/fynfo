import { useProfile } from '@/features/profile';
import { estimateAnnualCpf, estimateRecordedCpf } from '../lib/cpf-estimate';
import {
  calculateTaxSummary,
  type TaxProfileContext,
  type TaxSummary,
} from '../lib/tax-cpf';
import {
  buildInitialState,
  buildReliefItems,
  computeTotal,
} from '../lib/tax-reliefs';
import type { SalaryData } from '../types';
import { useTaxReliefs } from './use-tax-reliefs';

export interface SalaryYtdStats {
  profileState: 'loading' | 'error' | 'incomplete' | 'ready';
  retryProfile: () => void;
  reliefState: 'loading' | 'error' | 'ready';
  retryReliefs: () => void;
  reliefItems: ReturnType<typeof buildReliefItems>;
  currentYear: number;
  taxProfile: TaxProfileContext;
  currentYearRecords: SalaryData[];
  monthsRecorded: number;
  ytdSalary: number;
  ytdBonus: number;
  ytdOneTime: number;
  estAnnualSalary: number;
  estAnnualBonus: number;
  estSummary: TaxSummary | null;
  trueSummary: TaxSummary | null;
}

export function useSalaryYtdStats(records: SalaryData[]): SalaryYtdStats {
  const { data: profile, isPending, isError, refetch } = useProfile();
  const profileState = isPending
    ? 'loading'
    : isError
      ? 'error'
      : profile?.birthYear == null
        ? 'incomplete'
        : 'ready';
  const currentYear = new Date().getFullYear();
  const reliefs = useTaxReliefs(currentYear);

  const taxProfile: TaxProfileContext = {
    birthYear: profile?.birthYear ?? null,
    isNsman: profile?.isNsman ?? false,
    residencyStatus: profile?.residencyStatus ?? 'resident',
  };
  const reliefState =
    taxProfile.residencyStatus === 'non_resident'
      ? 'ready'
      : reliefs.isPending
        ? 'loading'
        : reliefs.isError
          ? 'error'
          : 'ready';
  const savedReliefState = buildInitialState(reliefs.data ?? null);
  const reliefItems =
    reliefState === 'ready' && taxProfile.residencyStatus !== 'non_resident'
      ? buildReliefItems(savedReliefState)
      : [];
  const additionalReliefsTotal =
    reliefState === 'ready' && taxProfile.residencyStatus !== 'non_resident'
      ? computeTotal(savedReliefState)
      : 0;

  const currentYearRecords = records.filter((r) =>
    r.id.startsWith(`${currentYear}-`)
  );
  // A month holding only one-time income says nothing about the recurring run
  // rate, so it must not dilute the annual estimate.
  const incomeMonths = currentYearRecords.filter((r) =>
    r.lines.some((line) => line.type !== 'one_time')
  );
  const monthsRecorded = incomeMonths.length;
  const ytdSalary = currentYearRecords.reduce((s, r) => s + r.recurring, 0);
  const ytdBonus = currentYearRecords.reduce((s, r) => s + r.bonus, 0);
  const ytdOneTime = currentYearRecords.reduce((s, r) => s + r.oneTime, 0);
  const estAnnualSalary =
    monthsRecorded > 0 ? (ytdSalary / monthsRecorded) * 12 : 0;
  const estAnnualBonus =
    monthsRecorded > 0 ? (ytdBonus / monthsRecorded) * 12 : 0;

  const recordedCpf = estimateRecordedCpf(currentYearRecords, currentYear);
  const estCpf = estimateAnnualCpf(
    estAnnualSalary,
    estAnnualBonus,
    currentYear
  );
  const estSummary =
    recordedCpf === null || estCpf === null || reliefState !== 'ready'
      ? null
      : calculateTaxSummary(
          estAnnualSalary,
          estAnnualBonus,
          currentYear,
          taxProfile,
          additionalReliefsTotal,
          estCpf,
          ytdOneTime
        );
  const trueSummary =
    recordedCpf === null || reliefState !== 'ready'
      ? null
      : calculateTaxSummary(
          ytdSalary,
          ytdBonus,
          currentYear,
          taxProfile,
          additionalReliefsTotal,
          recordedCpf,
          ytdOneTime
        );

  return {
    profileState,
    retryProfile: () => {
      void refetch();
    },
    reliefState,
    retryReliefs: () => {
      void reliefs.refetch();
    },
    reliefItems,
    currentYear,
    taxProfile,
    currentYearRecords,
    monthsRecorded,
    ytdSalary,
    ytdBonus,
    ytdOneTime,
    estAnnualSalary,
    estAnnualBonus,
    estSummary,
    trueSummary,
  };
}
