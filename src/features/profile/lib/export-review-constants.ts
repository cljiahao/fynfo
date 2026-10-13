export const EXPORT_REVIEW_MAX_BYTES = 1024 * 1024;
export const EXPORT_REVIEW_MAX_ROWS = 10_000;
export const EXPORT_REVIEW_MAX_STRING = 4096;
export const EXPORT_REVIEW_MAX_DEPTH = 32;

export const EXPORT_REVIEW_DOMAINS = [
  { key: 'profile', label: 'Profile' },
  { key: 'snapshots', label: 'Snapshots' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'salary', label: 'Salary' },
  { key: 'taxReliefs', label: 'Tax reliefs' },
  { key: 'trades', label: 'Trades' },
  { key: 'dividends', label: 'Dividends' },
  { key: 'plannerSettings', label: 'Planner settings' },
  { key: 'scenarios', label: 'Saved planning scenarios' },
  { key: 'merchantRules', label: 'Merchant rules' },
] as const;

export type ExportReviewDomain = (typeof EXPORT_REVIEW_DOMAINS)[number]['key'];

export const EXPORT_REVIEW_WARNINGS = {
  dividends: 'Version 1 does not include dividends.',
  scenarios: 'Versions 1 and 2 do not include saved planning scenarios.',
  merchantRules: 'Versions 1–3 do not include merchant rules.',
} as const;
