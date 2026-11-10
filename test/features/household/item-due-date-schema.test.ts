import {
  addGoalItemSchema,
  saveGoalItemSchema,
} from '@/features/household/schemas';
import { describe, expect, it } from 'vitest';

const GOAL = '44444444-4444-4444-8444-444444444444';
const base = { name: 'Venue', budget: 100 };

describe('item due date schemas', () => {
  it.each([
    ['saveGoalItemSchema', (v: unknown) => saveGoalItemSchema.safeParse(v)],
    [
      'addGoalItemSchema',
      (v: unknown) =>
        addGoalItemSchema.safeParse({ goalId: GOAL, ...(v as object) }),
    ],
  ])('%s: due date is optional and nullable', (_name, parse) => {
    expect(parse(base).success).toBe(true);
    expect(parse({ ...base, dueDate: null }).success).toBe(true);
    expect(parse({ ...base, dueDate: '2027-01-15' }).success).toBe(true);
  });

  it.each([
    'soon',
    '2027-1-5',
    '2027-02-31',
    '2027-13-01',
    '2027-01-15T00:00Z',
  ])('rejects %s', (value) => {
    expect(
      saveGoalItemSchema.safeParse({ ...base, dueDate: value }).success
    ).toBe(false);
    expect(
      addGoalItemSchema.safeParse({ goalId: GOAL, ...base, dueDate: value })
        .success
    ).toBe(false);
  });
});
