'use client';

import { Button } from '@/components/ui/button';
import { useAmountVisibility } from '@/features/privacy';
import { formatSGDWhole } from '@/lib/utils/currency';
import { useState } from 'react';
import type { HouseholdRecommendation } from '../lib/household-plan';
import { recommendationSentence } from '../lib/household-recommendation-copy';

const SHOWN = 3;

interface Props {
  recommendations: HouseholdRecommendation[];
  now: Date;
}

/** Plain-sentence plan notes, three at first. Renders nothing when empty. */
export function HouseholdRecommendations({ recommendations, now }: Props) {
  const { mask } = useAmountVisibility();
  const [all, setAll] = useState(false);
  if (recommendations.length === 0) return null;

  const money = (amount: number) => mask(formatSGDWhole(amount));
  const shown = all ? recommendations : recommendations.slice(0, SHOWN);
  const hidden = recommendations.length - SHOWN;

  return (
    <section aria-label="Recommendations" className="space-y-2">
      <ul className="space-y-2">
        {shown.map((rec, index) => (
          <li
            key={`${rec.kind}-${rec.goalId ?? 'all'}-${index}`}
            className="rounded-xl border p-3 text-sm"
          >
            {recommendationSentence(rec, { money, now })}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          aria-expanded={all}
          onClick={() => setAll((open) => !open)}
        >
          {all ? 'Show fewer' : 'Show all'}
        </Button>
      )}
    </section>
  );
}
