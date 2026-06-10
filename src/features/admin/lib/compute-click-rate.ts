/**
 * Click-through rate as a 0..1 fraction. Returns 0 when there are no page
 * views (avoids divide-by-zero / NaN reaching the UI).
 */
export function computeClickRate(pageViews: number, ctaClicks: number): number {
  if (pageViews <= 0) return 0;
  return ctaClicks / pageViews;
}
