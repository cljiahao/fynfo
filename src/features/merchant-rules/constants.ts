export const MERCHANT_RULE_LIMITS = {
  rules: 100,
  text: 256,
  payloadBytes: 131_072,
  ciphertextBytes: 262_144,
} as const;

export const MERCHANT_BANKS = ['uob', 'dbs', 'hsbc', 'citibank'] as const;
export const MERCHANT_MATCH_MODES = ['exact', 'phrase', 'starts'] as const;

export const MERCHANT_MATCH_MODE_LABELS = {
  exact: 'Exact text',
  phrase: 'Contains these words',
  starts: 'Starts with word',
} as const satisfies Record<(typeof MERCHANT_MATCH_MODES)[number], string>;

export const MERCHANT_MATCH_MODE_SHORT_LABELS = {
  exact: 'Exact',
  phrase: 'Phrase',
  starts: 'Starts with',
} as const satisfies Record<(typeof MERCHANT_MATCH_MODES)[number], string>;

export const MERCHANT_RULES_PER_PAGE = 10;
