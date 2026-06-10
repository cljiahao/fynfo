export interface DailyPoint {
  day: string; // ISO date "2026-06-11"
  pageViews: number;
  ctaClicks: number;
}

export interface MarketingTotals {
  pageViews: number;
  ctaClicks: number;
  clickRate: number; // 0..1
  signups: number;
}

export interface MarketingStats {
  totals: MarketingTotals;
  daily: DailyPoint[];
}
