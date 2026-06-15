---
id: 045
slug: grant-equity-dividends
area: fix
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-16
approved: 2026-06-16
shipped: 2026-06-16
impl_pr: direct-to-main (solo project)
supersedes:
constitution_satisfies:
  - '§5' # table access control — API role privileges alongside RLS
constitution_overrides:
---

# Spec 045: GRANT equity_dividends to the authenticated role

## Problem

Every read and write to `equity_dividends` failed in production with
`42501: permission denied for table equity_dividends` — surfaced as an empty
Distributions section (read swallowed by React Query) and a 500 on import/add
("dividend write failed"). Root cause: the spec-039 migration created the table +
RLS policy but never `GRANT`ed table privileges to the Supabase `authenticated`
role. GRANT is evaluated **before** RLS, so the role was denied table access
outright and RLS never ran. (The older tables were granted via Supabase's
auto-grant; this hand-applied migration slipped through.)

## Constitution check

- Satisfies `§5` (access control: API-role GRANT is the layer beneath RLS).
  Overrides: none. No new dependency. Additive privilege change — not destructive.

## Solution shape

- Append to `supabase/migrations/20260615000000_add_equity_dividends.sql`:
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.equity_dividends TO
authenticated;` so a fresh apply is correct. RLS continues to gate rows.
- Owner already ran the equivalent GRANT against the live DB to unblock prod.
- Template note for future table migrations: a new RLS table needs both a policy
  AND a GRANT to `authenticated`.

## Out of scope

- The amount=0 manual-add 400 (working as designed — validation correctly rejects
  a non-positive amount; user enters a positive amount).
- CDP/PO persistence (spec 044) and the dividend feature logic (unchanged).

## Acceptance

- [ ] Live: after the GRANT, Distributions reads populate and scan/add succeed
      (with a positive amount)
- [ ] Migration file contains the GRANT for reproducible fresh deploys
- [ ] `pnpm check` / `pnpm build` green (no app-code change; sanity only)

## Risk & reversibility

- **Blast radius**: privileges on one table. RLS unchanged, so row-level security is
  intact.
- **Reversibility**: `REVOKE ... ON public.equity_dividends FROM authenticated`.

## Open questions

- [ ] Q: none.
