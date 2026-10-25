export const STATEMENT_BANKS = [
  { value: 'uob', label: 'UOB', identity: /\bUOB\b|UNITED OVERSEAS BANK/i },
  { value: 'dbs', label: 'DBS', identity: /\bDBS\b|\bPOSB\b/i },
  { value: 'hsbc', label: 'HSBC', identity: /\bHSBC\b/i },
  { value: 'citibank', label: 'Citibank', identity: /\bCITI(?:BANK)?\b/i },
] as const;
export const IMPORT_OUTCOME_LABELS = {
  not_started: 'Not started',
  pending: 'Saving',
  confirmed: 'Confirmed saved',
  not_saved: 'Not saved',
  unconfirmed: 'Save unconfirmed',
  conflict: 'Saved record changed — review conflict',
} as const;
export const STATEMENT_CLASSIFICATIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'refund', label: 'Refund' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'card_repayment', label: 'Card repayment' },
  { value: 'other_credit', label: 'Other credit' },
  { value: 'unknown', label: 'Unknown' },
] as const;
export const STATEMENT_REVIEW_STATUS_LABELS = {
  candidate: 'Expense suggestion',
  unresolved: 'Needs review',
  excluded: 'Excluded from expenses',
} as const;
export const STATEMENT_LIMITS = {
  bytes: 10 * 1024 * 1024,
  pages: 100,
  characters: 2_000_000,
  textItems: 200_000,
  pixels: 4_000_000,
  deadlineMs: 45_000,
} as const;
export const STATEMENT_MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;
export const STATEMENT_ROWS_PER_PAGE = 20;
export const IMPORT_STEPS = [
  { value: 'choose', label: 'Choose' },
  { value: 'review', label: 'Review' },
  { value: 'check', label: 'Check' },
  { value: 'save', label: 'Save' },
  { value: 'done', label: 'Done' },
] as const;
export const DUPLICATE_RESOLUTIONS = [
  { value: 'keep', label: 'Keep both' },
  { value: 'skip', label: 'Skip' },
  { value: 'amend', label: 'Needs amend' },
] as const;
// Full class strings so Tailwind can see them; above Fit the canvas keeps its
// aspect ratio and the container scrolls.
export const STATEMENT_ZOOM_LEVELS = [
  {
    value: 'fit',
    label: 'Fit',
    factor: 1,
    className: 'h-full w-full object-contain',
  },
  {
    value: '100',
    label: '100%',
    factor: 1,
    className: 'h-auto w-full max-w-none',
  },
  {
    value: '150',
    label: '150%',
    factor: 1.5,
    className: 'h-auto w-[150%] max-w-none',
  },
  {
    value: '200',
    label: '200%',
    factor: 2,
    className: 'h-auto w-[200%] max-w-none',
  },
  {
    value: '300',
    label: '300%',
    factor: 3,
    className: 'h-auto w-[300%] max-w-none',
  },
] as const;
export const IMPORT_ABOUT_TEXT =
  'Self expenses in SGD only. Selected purchases are saved in automatic groups. Each expense saves its Item / Brand and an optional description you write; the statement text is not stored. Duplicate warnings do not guarantee prevention across imports.';
