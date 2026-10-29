export const MERCHANT_RULE_LIMITS = {
  rules: 100,
  text: 256,
  payloadBytes: 131_072,
  ciphertextBytes: 262_144,
} as const;

export const MERCHANT_BANKS = ['uob', 'dbs', 'hsbc', 'citibank'] as const;
export const MERCHANT_MATCH_MODES = ['exact', 'phrase'] as const;

export const MERCHANT_RULES_PER_PAGE = 10;
