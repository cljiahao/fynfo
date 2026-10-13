import type { MerchantDraft, MerchantSuggestion } from '../types';

/** Called only by explicit Apply. Manually edited fields require specific consent. */
export function applyMerchantSuggestion(
  draft: MerchantDraft,
  suggestion: MerchantSuggestion,
  replaceManual: { description: boolean; category: boolean } = {
    description: false,
    category: false,
  }
): MerchantDraft {
  return {
    ...draft,
    description:
      suggestion.displayName !== null &&
      (!draft.manual.description || replaceManual.description)
        ? suggestion.displayName
        : draft.description,
    category:
      suggestion.category !== null &&
      (!draft.manual.category || replaceManual.category)
        ? suggestion.category
        : draft.category,
    manual: { ...draft.manual },
  };
}

/** Restoration is explicit and counts as a manual choice, including empty values. */
export function restoreMerchantSource(
  draft: MerchantDraft,
  source: Pick<MerchantDraft, 'description' | 'category'>,
  fields: { description: boolean; category: boolean }
): MerchantDraft {
  return {
    description: fields.description ? source.description : draft.description,
    category: fields.category ? source.category : draft.category,
    manual: {
      description: draft.manual.description || fields.description,
      category: draft.manual.category || fields.category,
    },
  };
}
