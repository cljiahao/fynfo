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

export const RECENT_ACTIVITY_LIMIT = 8;

export const NO_ITEMS_SUMMARY = 'Split into budget items';

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

/** Literal classes so Tailwind sees them: `base` is the unpaid part, `paid` the shaded paid part. */
export const ITEM_BAR_FILLS = [
  { base: 'fill-chart-1/35', paid: 'fill-chart-1', dot: 'bg-chart-1' },
  { base: 'fill-chart-2/35', paid: 'fill-chart-2', dot: 'bg-chart-2' },
  { base: 'fill-chart-3/35', paid: 'fill-chart-3', dot: 'bg-chart-3' },
  { base: 'fill-chart-4/35', paid: 'fill-chart-4', dot: 'bg-chart-4' },
  { base: 'fill-chart-5/35', paid: 'fill-chart-5', dot: 'bg-chart-5' },
  { base: 'fill-chart-6/35', paid: 'fill-chart-6', dot: 'bg-chart-6' },
] as const;

export const ITEM_BAR_OTHER_FILL = {
  base: 'fill-muted-foreground/35',
  paid: 'fill-muted-foreground',
  dot: 'bg-muted-foreground',
} as const;

/** Unpaid part of every segment once saved plus still-to-pay exceeds the target. */
export const ITEM_BAR_OVER_FILL = 'fill-destructive/40';
