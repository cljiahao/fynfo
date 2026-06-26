export type HouseholdRole = 'owner' | 'member';

/** The caller's household, as returned by getHousehold(). Null if not in one. */
export interface HouseholdSummary {
  id: string;
  name: string;
  role: HouseholdRole;
  createdAt: string;
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
