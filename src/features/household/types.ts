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
}
