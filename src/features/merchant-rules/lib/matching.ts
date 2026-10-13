import type { MerchantBank, MerchantMatch, MerchantRule } from '../types';

/** Comparison only: preserve source and output strings exactly as entered. */
export function normalizeMerchant(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase()
    .normalize('NFC');
}

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && /[\p{L}\p{M}\p{N}]/u.test(value);
}

function phraseMatches(source: string, phrase: string): boolean {
  let offset = source.indexOf(phrase);
  while (offset !== -1) {
    // Array.from preserves supplementary Unicode code points at each boundary.
    const before = Array.from(source.slice(0, offset)).at(-1);
    const after = Array.from(source.slice(offset + phrase.length))[0];
    if (!isWordCharacter(before) && !isWordCharacter(after)) return true;
    offset = source.indexOf(phrase, offset + 1);
  }
  return false;
}

export function matchMerchantRules(
  originalDescription: string,
  bank: MerchantBank,
  rules: readonly MerchantRule[]
): MerchantMatch {
  const source = normalizeMerchant(originalDescription);
  const matches = rules.filter((rule) => {
    if (!rule.enabled || (rule.bank !== null && rule.bank !== bank))
      return false;
    const pattern = normalizeMerchant(rule.matchText);
    if (!pattern || !/[\p{L}\p{N}]/u.test(pattern)) return false;
    return rule.matchMode === 'exact'
      ? source === pattern
      : phraseMatches(source, pattern);
  });
  const exact = matches.filter((rule) => rule.matchMode === 'exact');
  const winners = exact.length ? exact : matches;
  if (!winners.length) return { status: 'none' };
  const tier = exact.length ? 'exact' : 'phrase';
  const first = winners[0];
  if (
    winners.some(
      (rule) =>
        rule.displayName !== first.displayName ||
        rule.category !== first.category
    )
  )
    return { status: 'conflict', tier, rules: winners };
  return {
    status: 'suggestion',
    tier,
    rules: winners,
    suggestion: { displayName: first.displayName, category: first.category },
  };
}
