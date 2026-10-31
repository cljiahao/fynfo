---
id: '160'
slug: household-table-grants
area: feature
status: draft # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-01
approved: # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes:
constitution_satisfies:
  - '§5.2'
  - '§6.2'
  - '§6.3'
constitution_overrides:
---

# Spec 160: Household table grants

## Problem

Production returned 500s on `/dashboard/household`. The server log carried `"context":"household spaces read","code":"42501"`. Postgres code `42501` is `insufficient_privilege`: the `authenticated` role had no table privilege at all. An RLS denial would return zero rows, not an error, because Postgres checks the GRANT before RLS (`supabase/migrations/20260615000000_add_equity_dividends.sql:24`).

Cause: two migrations created four tables, enabled RLS and added policies, but never granted privileges to `authenticated`:

- `supabase/migrations/20261023000149_household_project_items.sql`: `household_goal_items` (L11), `household_goal_payments` (L21).
- `supabase/migrations/20261023000150_household_shared_spending.sql`: `household_spaces` (L11), `household_spending` (L24).

Earlier household migrations grant explicitly: `20260626000000_add_household.sql:137-139` and `20260627000000_add_household_goals.sql:83-84`. Local dev hides the gap because local default privileges auto-grant to `authenticated`.

The owner hotfixed prod on 2026-10-30 by running the four GRANTs by hand. The repo still lacks them, so a fresh environment or a replay from migrations would repeat the outage.

## Constitution check

- Satisfies: `§5.2` (RLS and policies already ship in the same migrations and stay the access gate; the new grants are exact privileges, no `GRANT ALL`), `§6.2` (migration is applied to prod only after spec approval, and replayed on a fresh local DB first), `§6.3` (additive and forward-only; no drop, no data change).
- Overrides: none.
- No `HARD` rule is touched.

## Solution shape

One new migration, no app code, no new dependency.

- New file: `supabase/migrations/20261101000160_household_table_grants.sql` (sorts after the latest migration, `20261029000155_insert_imported_expenses.sql`).
- Content, one statement per table, in the style of the precedent migrations:

  ```sql
  GRANT SELECT, INSERT, DELETE ON TABLE public.household_goal_items TO authenticated;
  GRANT SELECT, INSERT, DELETE ON TABLE public.household_goal_payments TO authenticated;
  GRANT SELECT, INSERT, DELETE ON TABLE public.household_spaces TO authenticated;
  GRANT SELECT, INSERT, DELETE ON TABLE public.household_spending TO authenticated;
  ```

- Privilege choice: exactly `SELECT, INSERT, DELETE`, no `UPDATE`. Verified against the policies: each of the four tables has only SELECT, INSERT and DELETE policies (all policies in `20261023000149_household_project_items.sql` and `20261023000150_household_shared_spending.sql`) and no UPDATE policy. An UPDATE grant would be unused privilege (least privilege, `§5.2`).
- `GRANT` is idempotent in Postgres, so applying it after the 2026-10-30 hand hotfix is a no-op. The file header states it is additive and idempotent, matching the 149 and 150 headers.
- Encryption-touching code paths: none. Ciphertext columns and RLS policies are unchanged.
- Owner applies the migration to prod. Agents never run prod SQL.

### Test plan

New vitest migration-text test, `test/security/migration-grants.test.ts`, node environment. It reads every `supabase/migrations/*.sql` file as text, collects table names with the pattern `household_[a-z_]+` on the `CREATE TABLE` side. The plain `households` table is out of scope because it already has a grant (`20260626000000_add_household.sql:137`) and the pattern requires an underscore after `household`.

Parsing rules: match case-insensitively; split each file on `;` into statements; accept an optional `public.` qualifier and double-quoted names on both sides; for a `GRANT` statement, take every table named between `ON [TABLE]` and `TO` (so a multi-table list is matched per table) and require `authenticated` in the `TO` clause.

Scope is `household_%` only, not all public tables, because an all-tables rule would fail today on tables that deliberately or historically have no table grant to `authenticated`: the nine `init.sql` tables (`users_profile` and others, `20260411150000_init.sql`), `marketing_events`, `vault_unlock_attempts` and `vault_unlock_reservations` (service-role only, `20261008000000_security_rpc_boundaries.sql`). `personal_merchant_rulebooks` and `personal_recurring_rulebooks` grant `select` only, by design. Household tables are the one family where every table needs a direct grant, so the rule fits without an exception list. The rule is a floor: it checks that some grant exists, not that the privilege set is minimal.

Precedent for reading migration SQL as text in tests: `test/security/household-concurrency.mjs:3` reads `supabase/migrations/20261008000001_household_authorization.sql`. No existing vitest `.ts` test parses migrations, so this is a new pattern, not a copy.

Before the new migration exists the test must fail on exactly the four tables above, then pass once it lands.

### Post-apply verification (prod, owner-run)

```sql
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated' AND table_name LIKE 'household\_%'
ORDER BY 1, 2;
```

Expected for the four target tables: `DELETE`, `INSERT`, `SELECT`, with no `UPDATE`. The escaped pattern `'household\_%'` matches only names with a literal underscore, so `households` is not listed (an unescaped `_` is a wildcard and would list it). Rows for `household_members`, `household_invites`, `household_goals` and `household_goal_contributions` also appear and keep their own privileges.

## Out of scope

- Any app code, server action, UI or error-handling change.
- Changing RLS policies, table definitions or column grants.
- Granting `UPDATE`, or granting to `anon` or `service_role`.
- Backfilling grants on non-household tables, including `init.sql` tables and the two `personal_*_rulebooks` tables.
- Running anything against prod (owner applies).
- A default-privileges change (`ALTER DEFAULT PRIVILEGES`); that would grant implicitly and conflicts with the explicit-grant convention.

## Acceptance

- [ ] `pnpm format:check` green
- [ ] `pnpm lint` green
- [ ] `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new migration-grants test fails before the migration and passes after
- [ ] `pnpm build` green
- [ ] Migration replays cleanly on a fresh local DB after all earlier migrations (`§6.2`)
- [ ] Manual, owner: apply to prod; the verification query above shows `DELETE, INSERT, SELECT` on each of the four tables
- [ ] Manual, owner: `/dashboard/household` loads in prod with no `42501` in the logs
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: four household tables, `authenticated` role only. Prod already holds these grants from the hotfix, so applying the migration there changes nothing. A fresh environment gains the access the app already needs. RLS still scopes every row to household members.
- **Reversibility**: forward-only and additive (`§6.3`). A revert of the git commit does not undo grants already applied.
- **Backout plan**: `REVOKE SELECT, INSERT, DELETE ON TABLE public.<table> FROM authenticated;` for each of the four tables. This would re-break `/dashboard/household` (back to `42501`), so only use it if the grants are shown to be wrong, and then replace them with the correct set.

## Open questions

- [ ] Q: Should the test cover all public tables with an allow-list for service-role-only and historical tables, instead of `household_%` only? Spec chooses `household_%` for a rule with no exceptions. — Owner: Clarence — A:
- [ ] Q: Does the owner's hotfix match exactly `SELECT, INSERT, DELETE`, or did it also grant `UPDATE`? The verification query above answers it; if prod holds `UPDATE`, decide whether to revoke it in this migration. — Owner: Clarence — A:
