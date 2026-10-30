/** Invite secret lifetime before it expires unaccepted. */
export const INVITE_TTL_HOURS = 48;

/** A household links exactly two accounts (constitution §1.1). */
export const HOUSEHOLD_MEMBER_CAP = 2;

/** Window in which a deferred delete can still be undone. */
export const UNDO_DELAY_MS = 6000;

/** Identity colours; identity also carries a text label, never colour alone. Literal classes so Tailwind sees them. */
export const PERSON_COLORS = {
  you: { fill: 'fill-brand', dot: 'bg-brand' },
  partner: { fill: 'fill-chart-4', dot: 'bg-chart-4' },
} as const;

/** Lets the Spending tab header action focus the quick-add amount field. */
export const QUICK_ADD_AMOUNT_ID = 'quick-add-amount';
