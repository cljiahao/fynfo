---
id: 005
slug: rekey-rpc-id-text
area: fix
status: approved
author: clarence + claude (opus 4.7, 2026-05-28)
created: 2026-05-28
approved: 2026-05-28
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§Security' # rekey RPC must run to bump v1->v2; broken RPC blocks the migration path
  - '§Data integrity' # type-mismatched RPC fails before any UPDATE — no partial writes, but no progress either
constitution_overrides:
---

# Spec 005: rekey RPC `id` recordset type must be `text`, not `uuid`

## Problem

After spec 004 fixed read pagination/batching, the rekey now reaches the write RPC but PostgreSQL aborts the transaction with:

```
{"code":"42883","message":"operator does not exist: text = uuid","msg":"vault rekey RPC failed"}
```

The init migration (`20260411150000_init.sql`) defines every encrypted table's primary key as `"id" TEXT PRIMARY KEY` (equity_trades, expense_records, expense_splits, monthly_snapshots, asset_entries, salary_records, tax_relief_entries — only `users_profile.id` is `UUID`, mirroring `auth.users.id`).

The v2 RPC (`20260527000000_add_vault_v2.sql`) declares the jsonb input rowset as `u(id uuid, ...)` in every UPDATE block:

```sql
UPDATE public.equity_trades AS t
  SET ...
  FROM jsonb_to_recordset(p_equity_trades)
    AS u(id uuid, ticker text, shares text, price text, fees text)
  WHERE t.id = u.id AND t.user_id = p_user_id;
```

`t.id` is `text`, `u.id` is declared `uuid`. PostgreSQL has no implicit `text = uuid` operator. The first UPDATE fails, the whole transaction rolls back, vault stays v1. Failure is loud and clean — no partial writes — but no rekey progress either.

## Constitution check

- Satisfies: rekey path becomes functional end-to-end. No security posture change.
- Overrides: none.

## Solution shape

- New migration `supabase/migrations/20260528000000_fix_rekey_id_text.sql`.
- Body: `CREATE OR REPLACE FUNCTION public.rekey_user_data(...)` identical to the spec 001 version except every recordset declaration uses `id text` instead of `id uuid`. Affected tables in the RPC body: equity_trades, expense_records, expense_splits, salary_records, asset_entries, tax_relief_entries. (`p_user_id uuid` is unchanged — `users_profile.id` is genuinely UUID.)
- Re-issue `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated` against the new signature. Function signature (argument types) is unchanged so the existing GRANT carries, but re-asserting it is idempotent and matches the spec 001 migration's style.
- No schema change. No data change. No client/server TS change.

## Out of scope

- Migrating any table's `id` column from `text` to `uuid`. That would touch every read/write path and every existing row; not the bug being fixed.
- Adding a Postgres function-test for the RPC. Vitest can't reach Postgres in the current setup; manual verification via the failing user's unlock is the acceptance signal.
- Reordering or batching the per-table UPDATEs inside the RPC.

## Acceptance

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` green.
- [ ] Migration applied to Supabase (push or dashboard apply) before retest.
- [ ] Manual: user (83fe97e0-…) unlocks vault; server log shows `vault rekey complete` with `rowCounts: { equity_trades: N, expense_records: 3988, expense_splits: 649, asset_entries: N, salary_records: N, tax_relief_entries: N }` and `users_profile.vault_version = 2`.
- [ ] Manual: subsequent reads (expenses, equity, salary, assets) decrypt successfully under v2.

## Risk & reversibility

- **Blast radius**: rekey RPC only. v1 vaults still cannot unlock until applied. v2 vaults unaffected.
- **Reversibility**: `CREATE OR REPLACE FUNCTION` with the prior body restores the broken-but-typed signature. No data touched.
- **Backout plan**: if migration produces unexpected behaviour, re-apply spec 001's RPC body (broken) and investigate offline.

## Open questions

- [ ] None.
