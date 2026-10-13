export const RECURRING_LIMITS = {
  templates: 50,
  receipts: 1200,
  plaintextBytes: 524_288,
  ciphertextBytes: 1_048_576,
  name: 80,
  item: 256,
  notes: 4096,
  cents: 1_000_000_000_000,
} as const;
export const RECURRING_TIME_ZONE = 'Asia/Singapore';
export const THIRTY_DAY_MONTHS = [4, 6, 9, 11];
