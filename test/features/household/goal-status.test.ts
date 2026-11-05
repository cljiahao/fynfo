import { goalStatus } from '@/features/household/lib/goal-stats';
import { describe, expect, it } from 'vitest';
import { makeGoal } from './fixtures';

const NOW = new Date(2026, 10, 5);

function goal(target: number, contributed: number, targetDate: string | null) {
  return makeGoal({
    targetAmount: target,
    contributed,
    remaining: Math.max(0, target - contributed),
    targetDate,
    createdAt: '2026-10-05',
  });
}

describe('goalStatus', () => {
  it('is funded once the target is met', () => {
    expect(goalStatus(goal(100, 100, null), NOW)).toBe('funded');
    expect(goalStatus(goal(100, 150, '2020-01-01'), NOW)).toBe('funded');
  });

  it('is no-date without a target date', () => {
    expect(goalStatus(goal(100, 10, null), NOW)).toBe('no-date');
  });

  it('is behind once the target date has passed', () => {
    expect(goalStatus(goal(100, 10, '2026-11-04'), NOW)).toBe('behind');
  });

  it('is on-track when saved is at or above the straight-line pace', () => {
    expect(goalStatus(goal(1000, 600, '2026-12-05'), NOW)).toBe('on-track');
  });

  it('is behind when saved is under the pace', () => {
    expect(goalStatus(goal(1000, 100, '2026-12-05'), NOW)).toBe('behind');
  });

  it('compares in whole cents so float noise does not flip the result', () => {
    const today = new Date(2026, 9, 5);
    expect(goalStatus(goal(0.3, 0, '2026-10-06'), today)).toBe('behind');
    expect(goalStatus(goal(0.3, 0.1 + 0.2, '2026-10-06'), today)).toBe(
      'funded'
    );
  });

  it('counts a goal created today as one elapsed day, never zero', () => {
    const today = new Date(2026, 9, 5);
    expect(goalStatus(goal(1000, 17, '2026-12-05'), today)).toBe('on-track');
    expect(goalStatus(goal(1000, 0, '2026-12-05'), today)).toBe('behind');
    expect(goalStatus(goal(1000, 0, '2026-10-05'), today)).toBe('behind');
  });

  it('never reads a corrupt target as funded', () => {
    expect(goalStatus(goal(0, 0, null), NOW)).not.toBe('funded');
    expect(goalStatus(goal(NaN, 0, null), NOW)).not.toBe('funded');
  });
});
