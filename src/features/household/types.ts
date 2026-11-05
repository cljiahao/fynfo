export type HouseholdRole = 'owner' | 'member';

/** The caller's household, as returned by getHousehold(). Null if not in one. */
export interface HouseholdSummary {
  id: string;
  name: string;
  role: HouseholdRole;
  createdAt: string;
  /** Roster size; lets the UI hide the invite once the household is full. */
  memberCount: number;
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
  /** The estimate. */
  budget: number;
  /** Final quote; null until the household has one. */
  quote: number | null;
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

/** Result of saveGoal; validation and server failures never throw to the client. */
export type SaveGoalResult =
  | { ok: true; goalId: string; itemIds: string[] }
  | {
      ok: false;
      code: 'VALIDATION';
      error: { formErrors: string[]; fieldErrors: Record<string, string[]> };
    }
  | { ok: false; code: 'SERVER'; goalId: string; itemIds: string[] };

/** A monthly spending budget for one category of the household. */
export interface SpendingBudget {
  id: string;
  category: string;
  monthlyAmount: number;
}

export interface PlannerSplit {
  /** Percentage per household member id; totals 100. */
  members: Record<string, number>;
  /** Per-goal percentage overrides keyed by goal id, then member id. */
  goalOverrides: Record<string, Record<string, number>>;
  /** True when no split has been saved yet and the 50/50 default is shown. */
  isDefault: boolean;
  /** The caller, so the UI can label "your share". */
  userId: string;
}

export type PlannerCommitmentState = 'none' | 'locked' | 'ready';

export interface PlannerCommitmentGoal {
  goalId: string;
  name: string;
  bucket: 'reserve' | 'pace' | 'excluded';
  /** Caller's share: a one-off reserve, a monthly pace, or 0 when excluded. */
  amount: number;
  /** Caller's fraction (0 to 1) of this goal. */
  share: number;
  remaining: number;
  reason?: 'no-date' | 'funded';
}

/** The caller's household obligations as the personal planner consumes them. */
export interface PlannerCommitment {
  /** `none`: not in a household. `locked`: K_h not in session, counted as 0. */
  state: PlannerCommitmentState;
  /** True when no split was saved and 50/50 is assumed. */
  isDefaultSplit: boolean;
  reserve: number;
  monthlyDeduction: number;
  goals: PlannerCommitmentGoal[];
  budgets: { monthlyTotal: number; share: number; monthlyShare: number };
  excluded: {
    goalId: string;
    name: string;
    reason: 'no-date' | 'funded';
  }[];
}
