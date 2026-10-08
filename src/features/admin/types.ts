export interface DailyPoint {
  // ISO date "2026-06-11"
  day: string;
  pageViews: number;
  ctaClicks: number;
}

export interface MarketingTotals {
  pageViews: number;
  ctaClicks: number;
  // 0..1
  clickRate: number;
  signups: number;
}

export interface MarketingStats {
  totals: MarketingTotals;
  daily: DailyPoint[];
}
