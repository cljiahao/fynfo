export interface DailyPoint {
  // ISO calendar date (YYYY-MM-DD)
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
