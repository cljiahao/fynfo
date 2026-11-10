import type { HouseholdGoal } from '@/features/household/types';

export function makeGoal(
  overrides: Partial<HouseholdGoal> = {}
): HouseholdGoal {
  return {
    id: 'g1',
    name: 'Wedding',
    targetAmount: 10000,
    targetDate: null,
    createdAt: '2026-10-01',
    contributions: [],
    contributed: 0,
    remaining: 10000,
    pct: 0,
    items: [],
    budgeted: 0,
    paid: 0,
    ...overrides,
  };
}

export const goalWithItems: HouseholdGoal = makeGoal({
  contributions: [
    { id: 'c1', amount: 600, note: null, date: '2026-10-03', isSelf: true },
    { id: 'c2', amount: 400, note: null, date: '2026-10-09', isSelf: false },
  ],
  contributed: 1000,
  remaining: 9000,
  pct: 10,
  items: [
    {
      id: 'i1',
      name: 'Venue',
      budget: 8000,
      quote: null,
      dueDate: null,
      paid: 9000,
      remaining: 0,
      over: 1000,
      payments: [
        {
          id: 'p1',
          amount: 4500,
          note: null,
          date: '2026-10-02',
          isSelf: false,
        },
        {
          id: 'p2',
          amount: 4500,
          note: null,
          date: '2026-10-04',
          isSelf: true,
        },
      ],
    },
    {
      id: 'i2',
      name: 'Photographer',
      budget: 3000,
      quote: null,
      dueDate: null,
      paid: 0,
      remaining: 3000,
      over: 0,
      payments: [],
    },
  ],
  budgeted: 11000,
  paid: 9000,
});
