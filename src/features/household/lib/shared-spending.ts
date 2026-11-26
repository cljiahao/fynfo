import { normalizeCategory } from './spending-stats';

export interface SpendingLine {
  category: string;
  amount: number;
  /** The member who paid. */
  userId: string;
}

export interface MemberSpending {
  userId: string;
  paid: number;
  /** Paid minus an equal share; positive means the member is owed. */
  balance: number;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface SpendingSummary {
  total: number;
  byCategory: { category: string; total: number }[];
  /** One row per member, roster order first, then payers outside the roster. */
  members: MemberSpending[];
  /** Transfers that leave every member with an equal share; empty when even. */
  settlements: Settlement[];
}

const toCents = (value: number) => Math.round(value * 100);

/**
 * Equal shares of `total` cents across `ids`, remainder cents going to the
 * earliest sorted ids so every viewer computes the same split.
 */
function equalShares(ids: readonly string[], total: number) {
  const sorted = [...ids].sort();
  if (sorted.length === 0) return new Map<string, number>();
  const base = Math.floor(total / sorted.length);
  const extra = total - base * sorted.length;
  return new Map(
    sorted.map((id, index) => [id, base + (index < extra ? 1 : 0)] as const)
  );
}

function settle(balances: Map<string, number>): Settlement[] {
  const debtors = [...balances]
    .filter(([, cents]) => cents < 0)
    .map(([id, cents]) => ({ id, cents: -cents }));
  const creditors = [...balances]
    .filter(([, cents]) => cents > 0)
    .map(([id, cents]) => ({ id, cents }));
  const byAmount = (
    a: { id: string; cents: number },
    b: { id: string; cents: number }
  ) => b.cents - a.cents || a.id.localeCompare(b.id);
  const result: Settlement[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byAmount);
    creditors.sort(byAmount);
    const debtor = debtors[0];
    const creditor = creditors[0];
    const cents = Math.min(debtor.cents, creditor.cents);
    result.push({ from: debtor.id, to: creditor.id, amount: cents / 100 });
    debtor.cents -= cents;
    creditor.cents -= cents;
    if (debtor.cents === 0) debtors.shift();
    if (creditor.cents === 0) creditors.shift();
  }
  return result;
}

export function summarizeSpending(
  lines: SpendingLine[],
  memberIds: readonly string[] = []
): SpendingSummary {
  const paid = new Map<string, number>(memberIds.map((id) => [id, 0]));
  // Keyed by normalized category so case and spacing variants merge; the
  // first-seen casing is what gets displayed.
  const categories = new Map<string, { label: string; cents: number }>();
  let totalCents = 0;
  for (const line of lines) {
    const cents = toCents(line.amount);
    totalCents += cents;
    paid.set(line.userId, (paid.get(line.userId) ?? 0) + cents);
    const key = normalizeCategory(line.category);
    const entry = categories.get(key) ?? {
      label: line.category.trim(),
      cents: 0,
    };
    entry.cents += cents;
    categories.set(key, entry);
  }
  const shares = equalShares([...paid.keys()], totalCents);
  const balances = new Map(
    [...paid].map(([id, cents]) => [id, cents - (shares.get(id) ?? 0)])
  );
  return {
    total: totalCents / 100,
    byCategory: [...categories.values()]
      .map(({ label, cents }) => ({ category: label, total: cents / 100 }))
      .sort(
        (a, b) => b.total - a.total || a.category.localeCompare(b.category)
      ),
    members: [...paid].map(([userId, cents]) => ({
      userId,
      paid: cents / 100,
      balance: (balances.get(userId) ?? 0) / 100,
    })),
    settlements: settle(balances),
  };
}

/** `date` is ISO `YYYY-MM-DD`; `month` is `YYYY-MM`. */
export function inMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month;
}
