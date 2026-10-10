import type {
  OverviewReadData,
  OverviewSource,
} from '@/lib/overview-read-context';

export type OverviewReadOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'UNAVAILABLE' };

export type OverviewReadBundle = Partial<{
  [K in OverviewSource]: Promise<OverviewReadOutcome<OverviewReadData[K]>>;
}>;
export type OverviewReadAction = (
  sources: OverviewSource[]
) => Promise<OverviewReadBundle>;
