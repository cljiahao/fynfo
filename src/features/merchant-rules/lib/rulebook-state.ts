import type { MerchantRulebook, SaveRulebookInput } from '../types';

export function checkRulebookSave(
  input: SaveRulebookInput,
  current: MerchantRulebook | null
): 'saved' | 'unconfirmed' | 'conflict' {
  if (!current) return 'unconfirmed';
  if (current.id !== input.id) return 'conflict';
  if (current.revision === input.expectedRevision) return 'unconfirmed';
  return current.revision ===
    String(BigInt(input.expectedRevision) + BigInt(1)) &&
    JSON.stringify(current.payload) === JSON.stringify(input.payload)
    ? 'saved'
    : 'conflict';
}
