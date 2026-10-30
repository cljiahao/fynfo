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

// Apostrophes vanish (not split) so "McDonald's" reads as "mcdonalds";
// all other punctuation separates words.
function wordsForPrefix(value: string): string[] {
  return normalizeMerchant(value)
    .replace(/['’‘ʼ]/gu, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function startsWithWordMatches(source: string, pattern: string): boolean {
  const patternWords = wordsForPrefix(pattern);
  if (!patternWords.length) return false;
  const sourceWords = wordsForPrefix(source);
  const head = patternWords.slice(0, -1);
  const last = patternWords[patternWords.length - 1];
  for (let i = 0; i + patternWords.length <= sourceWords.length; i++) {
    if (
      head.every((word, offset) => sourceWords[i + offset] === word) &&
      sourceWords[i + head.length].startsWith(last)
    )
      return true;
  }
  return false;
}

const TIER_ORDER = ['exact', 'phrase', 'starts'] as const;

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
    if (rule.matchMode === 'exact') return source === pattern;
    if (rule.matchMode === 'phrase') return phraseMatches(source, pattern);
    return startsWithWordMatches(source, pattern);
  });
  const tier = TIER_ORDER.find((mode) =>
    matches.some((rule) => rule.matchMode === mode)
  );
  if (!tier) return { status: 'none' };
  const winners = matches.filter((rule) => rule.matchMode === tier);
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
