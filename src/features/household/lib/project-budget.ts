export interface ItemBudget {
  paid: number;
  remaining: number;
  /** Amount paid beyond the budget; 0 when within budget. */
  over: number;
}

export function computeItemBudget(
  budget: number,
  payments: number[]
): ItemBudget {
  const paid = payments.reduce((sum, n) => sum + n, 0);
  return {
    paid,
    remaining: Math.max(0, budget - paid),
    over: Math.max(0, paid - budget),
  };
}

export interface ProjectTotals {
  budgeted: number;
  paid: number;
  /** Sum of each item's overspend; underspend elsewhere does not offset it. */
  over: number;
}

export function computeProjectTotals(
  items: { budget: number; paid: number; over: number }[]
): ProjectTotals {
  return items.reduce(
    (totals, item) => ({
      budgeted: totals.budgeted + item.budget,
      paid: totals.paid + item.paid,
      over: totals.over + item.over,
    }),
    { budgeted: 0, paid: 0, over: 0 }
  );
}
