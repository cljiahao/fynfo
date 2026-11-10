import type { HouseholdRecommendation } from '@/features/household/lib/household-plan';
import { recommendationSentence } from '@/features/household/lib/household-recommendation-copy';
import { describe, expect, it } from 'vitest';

const now = new Date(2026, 10, 10);
const money = (n: number) => `$${Math.round(n)}`;
const say = (rec: HouseholdRecommendation) =>
  recommendationSentence(rec, { money, maskName: (name) => name, now });

describe('recommendationSentence', () => {
  it('words a shortfall', () => {
    expect(
      say({
        kind: 'shortfall',
        goalId: null,
        label: null,
        amounts: { shortfall: 120 },
        dates: {},
      })
    ).toBe(
      "This month's household share exceeds what's left by $120; it comes from savings."
    );
  });

  it('words a next payment in months, within a month and overdue', () => {
    const rec = (due: string): HouseholdRecommendation => ({
      kind: 'next-payment',
      goalId: 'g',
      label: 'Venue deposit',
      amounts: { amount: 2500 },
      dates: { due },
    });
    expect(say(rec('2027-01-10'))).toBe(
      'Venue deposit is due in 2 months; your share $2500.'
    );
    expect(say(rec('2026-11-20'))).toBe(
      'Venue deposit is due within a month; your share $2500.'
    );
    expect(say(rec('2026-10-01'))).toBe(
      'Venue deposit is overdue; your share $2500.'
    );
  });

  it('words behind with the catch-up per month', () => {
    expect(
      say({
        kind: 'behind',
        goalId: 'g',
        label: 'Renovation',
        amounts: { behind: 800, catchUpPerMonth: 150 },
        dates: { target: '2027-06-01' },
      })
    ).toBe('Renovation is $800 behind; $150 more a month catches up.');
  });

  it('words a monthly pace with and without a date', () => {
    const pace = (target: string | null): HouseholdRecommendation => ({
      kind: 'monthly-pace',
      goalId: 'g',
      label: 'Wedding',
      amounts: { monthly: 1200 },
      dates: { target },
    });
    expect(say(pace('2027-12-15'))).toBe(
      'Wedding: $1200 a month keeps you on track for Dec 2027.'
    );
    expect(say(pace(null))).toBe('Wedding: $1200 a month keeps you on track.');
  });

  it('words covered', () => {
    expect(
      say({
        kind: 'covered',
        goalId: 'g',
        label: 'Honeymoon',
        amounts: { covered: 900 },
        dates: {},
      })
    ).toBe('Your savings already cover Honeymoon.');
  });

  it('words missing data in singular and plural', () => {
    const missing = (count: number): HouseholdRecommendation => ({
      kind: 'missing-data',
      goalId: null,
      label: null,
      amounts: { count },
      dates: {},
    });
    expect(say(missing(2))).toBe(
      "2 goals have no date, so they aren't planned."
    );
    expect(say(missing(1))).toBe("1 goal has no date, so it isn't planned.");
  });

  it('routes every amount through the supplied formatter', () => {
    const masked = recommendationSentence(
      {
        kind: 'behind',
        goalId: 'g',
        label: 'Renovation',
        amounts: { behind: 800, catchUpPerMonth: 150 },
        dates: { target: '2027-06-01' },
      },
      { money: () => '****', maskName: () => '####', now }
    );
    expect(masked).toBe('#### is **** behind; **** more a month catches up.');
  });
});
