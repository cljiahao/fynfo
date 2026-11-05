import type { GoalStatus } from './lib/goal-stats';

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

/** Item segments shown on a breakdown bar before the rest collapse into "Other". */
export const ITEM_BAR_CAP = 6;

/** Upper bound on budget lines in one goal; keeps a save request and its diff small. */
export const GOAL_ITEM_LIMIT = 50;

export interface GoalTemplate {
  id: string;
  label: string;
  items: readonly string[];
}

/** Typical budget lines to prefill a new goal; amounts are left blank on purpose. */
export const GOAL_TEMPLATES: readonly GoalTemplate[] = [
  {
    id: 'wedding',
    label: 'Wedding',
    items: ['Venue', 'Catering', 'Photography', 'Attire', 'Rings'],
  },
  {
    id: 'renovation',
    label: 'Renovation',
    items: ['Design', 'Materials', 'Labour', 'Furniture', 'Contingency'],
  },
  {
    id: 'car',
    label: 'Car',
    items: ['Deposit', 'Insurance', 'Registration', 'Accessories'],
  },
] as const;

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  funded: 'Funded',
  'no-date': 'No date',
  'on-track': 'On track',
  behind: 'Behind',
};

/** Full calendar months averaged for a suggested category budget. */
export const BUDGET_SUGGESTION_MONTHS = 3;

export const CATEGORY_MAX_LENGTH = 40;

/** Error message when a budget's normalized category already has a budget. */
export const BUDGET_EXISTS = 'BUDGET_EXISTS';

export const USE_NEW_CATEGORY_LABEL = 'Use new category';

export const BUDGET_BAR_COLORS = {
  within: 'fill-primary',
  over: 'fill-loss',
} as const;
