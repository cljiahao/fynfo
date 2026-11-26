---
id: '201'
slug: household-member-names
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-27
approved: 2026-11-27 # approved_by Clarence, conversationally, for exactly this design
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # direct to main, set on shipped
supersedes: # none
constitution_satisfies:
  - '§1.1'
  - '§2.2'
  - '§2.3'
  - '§5.1a'
constitution_overrides: []
---

# Spec 201: Household member display names

## Problem

Members of a household (up to four) see each other as "Member N" and see themselves as "You",
because the roster carries user ids only. Goals, shared spending and the planner split are hard
to read when everyone is a number.

## Constitution check

- Satisfies §1.1 and §5.1a: the name is household data, sealed under K_h with the same helpers as
  goal names, so the server stores ciphertext only and never reads it.
- Satisfies §2.2 (mutation is a server action in `features/household/actions/`) and §2.3 (the
  action goes through `requireHouseholdContext`, which resolves the user and K_h before any DB
  access).
- No HARD rule is touched. The name is nullable, additive, and visible only to household members.

## Solution shape

- Migration `20261127000201_household_member_display_name.sql`: nullable `household_members.display_name text`.
- Write path: SECURITY DEFINER RPC `set_household_member_name(p_display_name text)` with
  `search_path = ''`, updating only `WHERE user_id = auth.uid()`. Chosen over a column-level
  `GRANT UPDATE (display_name)` plus an own-row policy because `UPDATE` on this table was revoked
  from `authenticated` (spec 197 hardening) and the RPC keeps that invariant: no column of
  `household_members` becomes directly updatable by members. The RPC also caps ciphertext length.
- Read path: the existing "Members read roster" SELECT policy already covers the new column.
- `actions/member-name-actions.ts`: `setMemberDisplayName(input)` validates with Zod (trimmed,
  1 to 40 chars), seals with `encryptPayload(name, kh)`, calls the RPC. Errors are opaque.
- `getHousehold` selects `display_name` with the roster and, when K_h is in the session, returns
  decrypted `memberNames` (a name that fails to decrypt is dropped, not thrown, so the caller is
  re-seeded with the default name, e.g. after a future K_h rotation).
- Default: when K_h is available and the caller's row has no name, `getHousehold` seals and saves
  the auth `user_metadata.full_name` (fallback: email local part, as in the user menu), truncated to
  40 chars. Best effort: any failure is swallowed so household load and unlock never break.
- `buildMemberLabels` shows the caller's own name when set and falls back to "You"; initials come
  from the name. All callers feed `memberNames` in.
- UI: "Your name in this household" control on the household page.

## Out of scope

K_h rotation, avatars, owner renaming other members, backfill of existing rows.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green
- [ ] Tests: action validation, own-row-only RPC call, sealing; roster decryption; default seeding; labels
- [ ] Migration applied by the owner before the code lands on main

## Risk & reversibility

- **Blast radius**: household roster read; code selecting `display_name` breaks before the migration is applied.
- **Reversibility**: rollback SQL in the migration header; the column is additive.
- **Backout plan**: revert the code commit, then run the rollback SQL.

## Open questions

None.
