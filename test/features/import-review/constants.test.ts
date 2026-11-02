import { STATEMENT_ROWS_PER_PAGE } from '@/features/import-review/constants';
import { expect, it } from 'vitest';

// Statement component tests mock this to 5 for speed; this pins the shipped value.
it('pages statement rows twenty at a time', () => {
  expect(STATEMENT_ROWS_PER_PAGE).toBe(20);
});
