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
