---
id: 054
slug: household-mvp-goals
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude (Opus 4.8)
approved_by: Clarence
created: 2026-06-27
approved: 2026-06-27
shipped: 2026-06-27
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§1.1' # the two-account household (gov-052)
  - '§2.1' # goal name/amount/note sealed AES-256-GCM under K_h
  - '§2.3' # goal actions: requireUserId() -> getHouseholdKhSession() (3rd exception, first real use)
  - '§2.4' # the household page composes feature components; no data-fetch in the page
  - '§5.1' # K_h-derived encryption, no new key class beyond §5.1a
  - '§5.2' # RLS + GRANT on the two new tables
  - '§4.2' # gated progress-math lib + action tests
constitution_overrides:
---

# Spec 054 (feature): Household MVP — big-item purchase goals

## Problem

Spec 053 shipped the household backend (membership, `K_h`, invites) but no
user-facing surface — nothing is encrypted under `K_h` yet and there is no page.
This spec delivers the MVP: a `/dashboard/household` page where the two members
create **big-item purchase goals** (e.g. "New sofa — $3,000") and log
contributions toward them, with a live progress bar visible to both. This is the
smallest joint surface that exercises the key-wrapping crypto end-to-end and
collides with nothing in the personal expense-split feature.

Design source of truth: `docs/superpowers/specs/2026-06-25-household-shared-vault-design.md` §6.

## Constitution check

- Satisfies `§1.1`, `§2.1` (goal `name`/`target_amount`/`note`/contribution
  `amount` sealed under `K_h`), `§2.3` (goal actions are the **first real use** of
  the `requireUserId()` → `getHouseholdKhSession()` third exception), `§2.4` (thin
  page composes feature components), `§5.1`/`§5.1a` (no new key class — reuses
  `K_h`), `§5.2` (RLS + GRANT on both tables), `§4.2` (gated math lib + tests).
- Overrides: none. gov-052 + spec 053 already established the household + `K_h`.
  No new dependency. No governance-path edit.

## Solution shape

### Migration `supabase/migrations/20260627000000_add_household_goals.sql`

Two tables, RLS-scoped to household membership (reuses `is_household_member()`
from spec 053), + GRANT:

- **`household_goals`** — `id UUID PK default gen_random_uuid()`, `household_id
UUID REFERENCES households(id) ON DELETE CASCADE`, `name TEXT NOT NULL`
  (encrypted under `K_h`), `target_amount TEXT NOT NULL` (encrypted), `target_date
DATE` (plaintext, optional — non-sensitive coarse metadata, never filtered on),
  `created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE`, `created_at`.
- **`household_goal_contributions`** — `id UUID PK`, `goal_id UUID REFERENCES
household_goals(id) ON DELETE CASCADE`, `contributor_user_id UUID REFERENCES
auth.users(id) ON DELETE CASCADE`, `amount TEXT NOT NULL` (encrypted), `note
TEXT` (encrypted, optional), `date DATE NOT NULL` (plaintext), `created_at`.

**RLS** (both): membership checked through the goal's household. For
`household_goals`: `USING (public.is_household_member(household_id))` for SELECT,
plus `WITH CHECK (public.is_household_member(household_id) AND created_by =
auth.uid())` for INSERT, and member-scoped UPDATE/DELETE. For
`household_goal_contributions`: gate via the parent goal —
`USING (EXISTS (SELECT 1 FROM public.household_goals g WHERE g.id = goal_id AND
public.is_household_member(g.household_id)))`, with the same EXISTS in the INSERT
`WITH CHECK` plus `contributor_user_id = auth.uid()`. Index
`household_goals(household_id)` and `household_goal_contributions(goal_id)`.
`§5.4` respected — no SQL filters/sorts on the encrypted columns; ordering is by
plaintext `created_at`/`date`.

### `requireHouseholdContext()` in `src/lib/action-guard.ts`

New helper mirroring `requireActionContext` but for the household key: returns
`{ userId, kh, supabase }`, where `kh` comes from `getHouseholdKhSession()` and a
locked household throws `new Error('Household is locked. Please unlock.')`. This
is the `§2.3` third-exception gate in code form (identity first, then `K_h`).

### `src/features/household/lib/goal-progress.ts` (NEW — pure, gated)

- `interface GoalProgress { contributed: number; target: number; remaining: number;
pct: number }`.
- `computeGoalProgress(target: number, contributions: number[]): GoalProgress` —
  `contributed = sum`, `remaining = max(0, target - contributed)`, `pct =
target > 0 ? min(100, round((contributed / target) * 100)) : 0`. Pure; unit-tested.

### `src/features/household/actions/goal-actions.ts` (NEW)

All use `requireHouseholdContext()` (identity + `K_h`), validate via `parseOrThrow`,
seal/open with `encryptPayload`/`decryptPayload` under `kh`, wrap DB errors opaque.

- `getGoals(): Promise<HouseholdGoal[]>` — read goals for the caller's household +
  their contributions (two reads or an embedded select), decrypt `name`/
  `target_amount`/contribution `amount`/`note` under `kh`, attach
  `computeGoalProgress`. Returns `[]` if none; throws opaque on read error (spec-032
  contract).
- `createGoal(input): Promise<void>` — seal `name`/`target_amount`; insert with
  `created_by = userId`, `household_id` resolved from the caller's membership.
- `addContribution(input): Promise<void>` — seal `amount`/`note`; insert with
  `contributor_user_id = userId`.
- `deleteGoal(id): Promise<void>` — scoped delete (RLS + household membership).

### `src/features/household/schemas.ts` (extend)

`createGoalSchema` (`name` 1-80, `targetAmount` > 0 finite, optional
`targetDate` ISO), `addContributionSchema` (`goalId` uuid, `amount` > 0 finite,
optional `note` ≤ 200, `date` ISO).

### Hooks `src/features/household/hooks/` (NEW, `'use client'`)

- `useHousehold()` — `useQuery` over `getHousehold()`.
- `useGoals()` — `useQuery` over `getGoals()`; `useCreateGoal` / `useAddContribution`
  / `useDeleteGoal` mutations that invalidate the goals key. `useUnlockHousehold` /
  `useCreateHousehold` / `useAcceptInvite` / `useCreateInvite` wrap the 053 actions.

### Components `src/features/household/components/` (NEW, follow frontend-design)

- `HouseholdOverview` — orchestrates the three states: **no household** (create or
  join-with-code), **locked** (an "Unlock household" button calling
  `unlockHousehold` — requires the personal vault already unlocked), **unlocked**
  (goals list + create-goal dialog + per-goal add-contribution).
- `GoalList` / `GoalCard` (name, contributed/target, progress bar, target date,
  who contributed), `CreateGoalForm`, `AddContributionForm`, `InvitePanel` (owner
  mints + reveals the one-time secret), `JoinHouseholdForm` (enter invite code).
- Loading skeleton + empty/error states per the existing dashboard convention.

### Page + nav

- `src/app/dashboard/household/page.tsx` — thin `'use client'` page rendering
  `<HouseholdOverview />` from `@/features/household` (no data-fetch in the page,
  `§2.4`).
- `src/lib/constants/routes.ts` — add `HOUSEHOLD` route.
- `src/components/layout/dashboard-navbar.tsx` — add a "Household" `NAV_ITEMS` entry.
- `src/features/household/index.ts` — extend the barrel with the new components,
  hooks, and types.

## Out of scope

- Member-removal / dissolution **re-key** (`K_h` rotation) — still its own later spec.
- Travel budgets, joint plan, shared budget (design-doc later surfaces).
- Invite **revoke** UI and any invite-management beyond create/accept.
- Client-side WebCrypto wrapping (deferred per design-doc §12).
- Editing a goal after creation (delete + recreate is acceptable for MVP).

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] `goal-progress.ts` gated (lines/statements 95, functions 100, branches 85):
      sum/percent/remaining, zero-target guard, over-100% clamp.
- [ ] `goal-actions.ts` action tests (node-env, `fake-supabase`, mocked
      `requireHouseholdContext`): create seals `name`/`target_amount` (ciphertext,
      not plaintext); getGoals decrypts + attaches progress; addContribution seals
      `amount`; opaque error on a read/write failure; invalid input rejected before
      any DB write.
- [ ] `requireHouseholdContext` throws when the household is locked.
- [ ] Migration applies on a fresh DB; RLS denies a non-member SELECT on both
      tables; contributions gate through the parent goal's household.
- [ ] Manual: create household → create a goal → add a contribution → progress bar
      updates; second member joins via invite code and sees the same goals.
- [ ] No `any`, no `console.log`, no new dependency, no governance-path edit.
- [ ] Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: additive — two new tables, new actions/hooks/components, one new
  page + one nav entry. No existing feature or the personal vault is touched. The
  household page is reachable only by a logged-in, vault-unlocked user.
- **Reversibility**: revert the impl commit; ship a `DROP TABLE
household_goal_contributions, household_goals CASCADE;` companion migration
  (safe while unused). The 053 household tables are unaffected.
- **Backout plan**: revert code + drop the two goal tables; the `/dashboard/household`
  route 404s, nav entry gone.

## Open questions

- [x] Q: `getGoals` shape — one embedded select vs two reads joined in app code? —
      Owner: Clarence — A: **two reads** joined in app code, to keep the
      `fake-supabase` action tests simple and avoid the embedded-array typing
      friction hit in spec 053. (approved)
- [x] Q: Show each member's name/email on contributions, or just "you" vs "partner"?
      — Owner: Clarence — A: **"you" vs "partner"** by comparing
      `contributor_user_id` to the caller — avoids surfacing the partner's email and
      needs no extra profile read. (approved)
- [x] Q: Goal `target_date` encrypted or plaintext? — Owner: Clarence — A:
      **plaintext DATE** — coarse, non-sensitive, never filtered on; §5.4-clean.
      (approved)
