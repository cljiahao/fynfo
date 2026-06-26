import { computeGoalProgress } from '@/features/household/lib/goal-progress';
import { describe, expect, it } from 'vitest';

describe('computeGoalProgress', () => {
  it('sums contributions and computes percent + remaining', () => {
    expect(computeGoalProgress(1000, [200, 300])).toEqual({
      contributed: 500,
      target: 1000,
      remaining: 500,
      pct: 50,
    });
  });

  it('returns zeroed progress for no contributions', () => {
    expect(computeGoalProgress(1000, [])).toEqual({
      contributed: 0,
      target: 1000,
      remaining: 1000,
      pct: 0,
    });
  });

  it('clamps percent at 100 and remaining at 0 when over-funded', () => {
    const p = computeGoalProgress(1000, [800, 400]);
    expect(p.contributed).toBe(1200);
    expect(p.remaining).toBe(0);
    expect(p.pct).toBe(100);
  });

  it('guards against a zero target (no divide-by-zero)', () => {
    expect(computeGoalProgress(0, [50])).toEqual({
      contributed: 50,
      target: 0,
      remaining: 0,
      pct: 0,
    });
  });

  it('rounds the percent to a whole number', () => {
    expect(computeGoalProgress(3, [1]).pct).toBe(33);
  });
});
