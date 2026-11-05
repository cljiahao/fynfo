import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '20261105000175_household_redesign.sql'
  ),
  'utf8'
)
  .replace(/--[^\n]*/g, '')
  .replace(/\s+/g, ' ');

describe('spec 175 household redesign migration', () => {
  it('adds the quote column idempotently', () => {
    expect(sql).toContain(
      'ALTER TABLE public.household_goal_items ADD COLUMN IF NOT EXISTS quote TEXT'
    );
  });

  it('creates the budgets table with RLS enabled and full grants', () => {
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS public.household_spending_budgets'
    );
    expect(sql).toContain(
      'ALTER TABLE public.household_spending_budgets ENABLE ROW LEVEL SECURITY'
    );
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.household_spending_budgets TO authenticated'
    );
  });

  it('grants UPDATE on items and payments', () => {
    for (const table of ['household_goal_items', 'household_goal_payments']) {
      expect(sql).toContain(
        `GRANT UPDATE ON TABLE public.${table} TO authenticated`
      );
    }
  });

  it('guards every policy with a drop-if-exists so the file can be replayed', () => {
    const created = [...sql.matchAll(/CREATE POLICY "([^"]+)" ON ([\w.]+)/g)];
    expect(created.length).toBeGreaterThanOrEqual(7);
    for (const [, name, table] of created) {
      expect(sql).toContain(`DROP POLICY IF EXISTS "${name}" ON ${table}`);
    }
  });

  it('keeps payer and contributor fixed on update', () => {
    for (const [policy, column] of [
      ['Members update goal payments', 'payer_user_id'],
      ['Members update contributions', 'contributor_user_id'],
    ]) {
      const start = sql.indexOf(`CREATE POLICY "${policy}"`);
      const body = sql.slice(start, sql.indexOf('CREATE POLICY', start + 1));
      expect(body).toMatch(
        new RegExp(`USING \\( ${column} = auth\\.uid\\(\\)`)
      );
      expect(body).toMatch(
        new RegExp(`WITH CHECK \\( ${column} = auth\\.uid\\(\\)`)
      );
    }
  });
});
