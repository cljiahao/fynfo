export type HouseholdRole = 'owner' | 'member';

/** The caller's household, as returned by getHousehold(). Null if not in one. */
export interface HouseholdSummary {
  id: string;
  name: string;
  role: HouseholdRole;
  createdAt: string;
  /** True when the household key is not in the session (needs unlock). */
  locked: boolean;
}

export interface CreateHouseholdResult {
  householdId: string;
}

/** Raw one-time invite secret — shown to the owner ONCE, handed off out-of-band. */
export interface InviteResult {
  secret: string;
}

export interface AcceptInviteResult {
  householdId: string;
}

export interface GoalContribution {
  id: string;
  amount: number;
  note: string | null;
  date: string;
  /** True if the current caller logged this contribution ("you" vs "partner"). */
  isSelf: boolean;
}

export interface GoalItemPayment {
  id: string;
  amount: number;
  note: string | null;
  date: string;
  /** True if the current caller recorded this payment. */
  isSelf: boolean;
}

/** One budget line of a project goal, e.g. "Venue" for a wedding. */
export interface GoalItem {
  id: string;
  name: string;
  budget: number;
  payments: GoalItemPayment[];
  paid: number;
  remaining: number;
  /** Amount paid beyond the budget; 0 when within budget. */
  over: number;
}

export interface HouseholdGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  createdAt: string;
  contributions: GoalContribution[];
  contributed: number;
  remaining: number;
  pct: number;
  items: GoalItem[];
  /** Sum of item budgets. */
  budgeted: number;
  /** Sum of payments across items. */
  paid: number;
}

export type HouseholdSpaceKind = 'ongoing' | 'trip';

export interface SharedSpendingEntry {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string | null;
  /** True if the current caller paid. */
  isSelf: boolean;
}

/** A group of shared spending: day-to-day household costs, or one trip. */
export interface HouseholdSpace {
  id: string;
  kind: HouseholdSpaceKind;
  name: string;
  startDate: string | null;
  endDate: string | null;
  entries: SharedSpendingEntry[];
}
