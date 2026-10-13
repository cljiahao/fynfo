import {
  applyMerchantSuggestion,
  restoreMerchantSource,
} from '@/features/merchant-rules/lib/review-draft';
import type { MerchantDraft } from '@/features/merchant-rules/types';
import { describe, expect, it } from 'vitest';

const draft: MerchantDraft = {
  description: 'Source merchant',
  category: 'other',
  manual: { description: false, category: false },
};
const suggestion = {
  displayName: 'Suggested merchant',
  category: 'groceries' as const,
};

describe('explicit merchant apply and manual precedence', () => {
  it('applies only suggested fields and does not mutate its inputs', () => {
    expect(applyMerchantSuggestion(draft, suggestion)).toMatchObject({
      description: 'Suggested merchant',
      category: 'groceries',
    });
    expect(draft.description).toBe('Source merchant');
    expect(
      applyMerchantSuggestion(draft, {
        displayName: null,
        category: 'groceries',
      }).description
    ).toBe(draft.description);
  });
  it('preserves manual edits per field, including an intentional empty description', () => {
    const edited = {
      ...draft,
      description: '',
      manual: { description: true, category: false },
    };
    expect(applyMerchantSuggestion(edited, suggestion)).toEqual({
      ...edited,
      category: 'groceries',
    });
    const categoryEdited = {
      ...draft,
      category: 'travel' as const,
      manual: { description: false, category: true },
    };
    expect(applyMerchantSuggestion(categoryEdited, suggestion)).toEqual({
      ...categoryEdited,
      description: 'Suggested merchant',
    });
  });
  it('requires specific replacement consent for each manual field', () => {
    const edited: MerchantDraft = {
      ...draft,
      description: 'Mine',
      category: 'travel',
      manual: { description: true, category: true },
    };
    expect(
      applyMerchantSuggestion(edited, suggestion, {
        description: true,
        category: false,
      })
    ).toEqual({ ...edited, description: 'Suggested merchant' });
    expect(
      applyMerchantSuggestion(edited, suggestion, {
        description: false,
        category: true,
      })
    ).toEqual({ ...edited, category: 'groceries' });
  });
  it('explicit restoration stays a manual choice and blocks later incidental replacement', () => {
    const applied = applyMerchantSuggestion(draft, suggestion);
    const restored = restoreMerchantSource(applied, draft, {
      description: true,
      category: false,
    });
    expect(restored).toEqual({
      description: draft.description,
      category: 'groceries',
      manual: { description: true, category: false },
    });
    expect(applyMerchantSuggestion(restored, suggestion).description).toBe(
      draft.description
    );
  });
});
