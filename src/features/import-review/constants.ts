export const STATEMENT_BANKS = [
  { value: 'uob', label: 'UOB', identity: /\bUOB\b|UNITED OVERSEAS BANK/i },
  { value: 'dbs', label: 'DBS', identity: /\bDBS\b|\bPOSB\b/i },
  { value: 'hsbc', label: 'HSBC', identity: /\bHSBC\b/i },
  { value: 'citibank', label: 'Citibank', identity: /\bCITI(?:BANK)?\b/i },
] as const;
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
