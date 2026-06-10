import { computeClickRate } from '@/features/admin/lib/compute-click-rate';
import { describe, expect, it } from 'vitest';

describe('computeClickRate', () => {
  it('returns 0 when there are no (or negative) page views', () => {
    expect(computeClickRate(0, 0)).toBe(0);
    expect(computeClickRate(0, 5)).toBe(0);
    expect(computeClickRate(-3, 5)).toBe(0);
  });

  it('computes clicks / views', () => {
    expect(computeClickRate(100, 25)).toBe(0.25);
    expect(computeClickRate(4, 1)).toBe(0.25);
    expect(computeClickRate(10, 0)).toBe(0);
  });
});
