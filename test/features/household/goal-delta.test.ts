import { computeGoalDelta } from '@/features/household/lib/goal-delta';
import { describe, expect, it } from 'vitest';
import { makeGoal } from './fixtures';

describe('computeGoalDelta', () => {
  it('treats every row as added for a new goal', () => {
    const delta = computeGoalDelta(undefined, {
      target: 1000,
      items: [
        { name: 'a', budget: 100, quote: null },
        { name: 'b', budget: 50, quote: 40 },
      ],
    });
    expect(delta).toMatchObject({
      targetOld: null,
      targetNew: 1000,
      committedOld: null,
      committedNew: 140,
      added: 2,
      changed: 0,
      removed: 0,
    });
  });

  it('counts changed and removed rows and names removed rows with payments', () => {
    const paid = {
      id: 'i1',
      name: 'Frame',
      budget: 100,
      quote: null,
      dueDate: null,
      paid: 30,
      remaining: 70,
      over: 0,
      payments: [
        { id: 'p1', amount: 30, note: null, date: '2026-10-01', isSelf: true },
      ],
    };
    const plain = { ...paid, id: 'i2', name: 'Legs', paid: 0, payments: [] };
    const goal = makeGoal({ targetAmount: 1000, items: [paid, plain] });
    const delta = computeGoalDelta(goal, {
      target: 1200,
      items: [{ id: 'i2', name: 'Legs', budget: 120, quote: null }],
    });
    expect(delta.targetOld).toBe(1000);
    expect(delta.targetNew).toBe(1200);
    expect(delta.changed).toBe(1);
    expect(delta.removed).toBe(1);
    expect(delta.removedWithPayments).toEqual(['Frame']);
    expect(delta.committedNew).toBe(120);
  });
});
