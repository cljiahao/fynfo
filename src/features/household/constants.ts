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

export const HOUSEHOLD_PATH = '/dashboard/household';

export const GOAL_DETAIL_PATH = (id: string) => `${HOUSEHOLD_PATH}/goals/${id}`;

/** Largest items shown in the budget chart; the full list sits below it. */
export const ITEM_CHART_CAP = 8;

export const RECENT_ACTIVITY_LIMIT = 8;

export const NO_ITEMS_SUMMARY = 'Split into budget items';

/** Keeps the horizontal bar axis from squeezing the plot area at 375px. */
export const ITEM_CHART_NAME_WIDTH = 92;
