---
id: '200'
slug: goal-membership
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-25
approved: 2026-11-25
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes: # none
constitution_satisfies:
  - '§1.1'
  - '§1.2'
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§5.1a'
  - '§5.2'
  - '§5.4'
constitution_overrides: [] # the HARD changes are authorized by governance/197
---

# Spec 200: Households of up to four members and per-goal membership

## Problem

The household feature assumes exactly two people: one "you" and one "partner". The cap trigger
stops at two, goals have no notion of who is involved, and the UI, the paid-by logic, the
percentage split and the planner deduction all hardcode a pair. Owner decisions 2026-11-25:
a household holds up to four adult members (own logins); household membership (invite and join)
is separate from goal membership; every household member sees all goals and can add themself to
a goal; a goal involves 1 to 4 members; kids are dependents without accounts.

## Constitution check

- **Blocked by `specs/governance/197-household-up-to-four.md`.** §1.1 and §1.2 (HARD) cap the
  household at two until 197 is approved and committed; this spec adds no override.
- Satisfies §2.1 (zero-knowledge: no new plaintext financial data), §2.2 (mutations are server
  actions in `features/household/actions/`), §2.3 item 3 (`requireUserId()` then
  `getHouseholdKhSession()` on every household action), §5.1a (no new key; rotation stays deferred
  per 197), §5.2 (RLS on the new table) and §5.4 (no SQL on encrypted columns).
- No SOFT overrides. No new dependency.

## Solution shape

### Slicing

Ship as two ordered slices, each its own PR with all five gates green.

1. **Slice A, data and actions.** Migration, goal-membership actions, `resolvePayerId` generalized,
   split utilities generalized to N members, schemas, types, tests.
2. **Slice B, UI.** Member display names, goal cards, join/leave-goal control, N-way split editor,
   N-person copy, invite dialog and setup copy, planner deduction.

Slice A is safe to deploy alone: with the cap at four but no UI path to the old two-person
assumptions, behavior for two-member households is unchanged (a goal with no membership rows is
treated as "all household members", see Migration).

### Migration (Slice A)

New file `supabase/migrations/<ts>_household_goal_members.sql`, additive and reversible:

- Replace `enforce_household_member_cap()` (current body in
  `20261008000001*:7-36`, which counts rows and raises at `>= 2`) with the same function at
  `>= 4`. Keep `SECURITY DEFINER SET search_path = ''`, the `REVOKE`, the households row lock and
  the trigger as is. Keep `UNIQUE (user_id)` (`household_members_one_household_per_user`).
- Create `public.household_goal_members (goal_id uuid references household_goals(id) on delete
cascade, user_id uuid references auth.users(id) on delete cascade, added_at timestamptz,
primary key (goal_id, user_id))`. No encrypted columns, so §5.4 is untouched.
- Cap of four goal members: a trigger like the household one (count rows per goal, raise at
  `>= 4`), plus a check trigger that `user_id` is a member of the goal's household.
- RLS (§5.2): SELECT for members of the goal's household; INSERT only `user_id = auth.uid()` for a
  member of that household; DELETE only `user_id = auth.uid()`. No UPDATE policy. Use the existing
  household-membership helper functions used by `household_goals` policies.
- Backfill: for each existing goal insert a row per current household member, so existing
  two-person goals keep both members and nothing changes visibly.
- Per spec 197 Option A, `DROP POLICY "Member leaves own row" ON household_members`
  (`20260626000000_add_household.sql:125-127`). Leave and remove stay disabled until the
  rotation spec. If the owner picks 197 Option B or C this bullet changes accordingly.
- Rollback file note: cap back to 2 only if no household has more than two members; goal-members
  table drop is lossless for goal data.

### Actions (Slice A), in `features/household/actions/`

- `joinGoal(goalId)` and `leaveGoal(goalId)` (self only). Each: `requireUserId()` then
  `getHouseholdKhSession()`, Zod `safeParse`, opaque error messages (AGENTS.md §4).
  Leaving the last member is rejected (a goal keeps 1 to 4 members). Goal creation inserts the
  creator as the first member.
- A goal's contributions, items and payments stay visible to every household member; membership
  only decides who is shown on the card, who is offered as payer, and who the default split covers.
- `resolvePayerId` (`goal-actions.ts:351`, signature `paidBy: 'self' | 'partner'`, partner found
  by scanning the roster at lines 354-365): replace with an explicit `payerUserId` validated
  server-side as a household member (and a goal member when the goal has any). `paidBySchema`
  (`schemas.ts:31`, `z.enum(['self','partner'])`) becomes a uuid string. Keep `'self'` accepted as
  an alias for one release only if existing client code needs it; otherwise remove it.
- `split-utils.ts:10` `partnerIdOf` and `:22` `overrideFor` (two-member override): replace with
  helpers over `split.members` that take an explicit list of member ids and distribute a
  remainder; `PlannerSplit.members` is already keyed by user id so the stored shape is N-capable.
  Percentages stay integers summing to 100 (largest-remainder rounding).
- `planner-actions.ts:182-204` and `plan-actions.ts:27`: the comments and the stale-write guard
  mention one partner. The blob is one row, so the optimistic-version guard already protects
  against any concurrent member; verify and reword only, with a regression test using three writers.

### UI (Slice B)

Verify each file at implementation time; replace "You"/"Partner" with member display names
("You" is kept only for the caller).

- Member display names come from one helper (`features/household`) reading the roster; fall back
  to a stable "Member N" when a name is missing.
- Goal cards: show member avatars/initials and a "Join this goal" / "Leave goal" control that
  calls the actions above. Files: `goal-summary.tsx` (self vs partner bar and legend, uses
  `PERSON_COLORS.partner` from `constants.ts`; becomes one segment per member with a four-color
  palette), `goal-item-list.tsx`.
- Two-person copy and logic to replace: `paid-by-picker.tsx` (You/Partner picker becomes a member
  list), `goal-activity.tsx`, `shared-spending.tsx` and `lib/shared-spending.ts` (`youPaid` /
  `partnerPaid` and the even-split settle-up become per-member totals and a settle-up across N
  members, equal share per goal member), `spending-summary.tsx`, `add-contribution-dialog.tsx`,
  `edit-payment-dialog.tsx`, `goal-editor-sheet.tsx`, `goal-split-override.tsx` ("Your partner
  sees this split"), `split-picker.tsx` ("Just partner", "You x%, partner y%"; becomes an even split
  over chosen members or a custom per-member percentage), `planner-split-editor.tsx` (two-way %
  split becomes N rows that must total 100, with the remainder shown live),
  `household-overview.tsx` ("Only the owner can invite a partner"), `invite-partner-dialog.tsx`
  (becomes "Invite member", shows "x of 4 members"), `household-setup.tsx`.
  `assets/components/planning-scenarios.tsx:145` ("your household partner can't see them") is
  reworded to "other household members".
- `types.ts:33` comment ("you" vs "partner") is reworded.

### Planner household deduction

`salary-planner.tsx:385-407` feeds `computeHouseholdPlan` (`lib/household-plan.ts:186`) and takes
`householdPlan.monthly` as the caller's deduction; `PlannerSplit.members` percentages already say
how much each member carries. Rule: each member's deduction for a goal is their percentage of that
goal's required monthly amount, where the default percentage is an even share across the goal's
members (not the household), and a per-goal override (`overrideFor` replacement) may change it.
A member who is not on a goal carries nothing for it. `computeHouseholdPlan` and its
recommendation copy must iterate the caller's own share only, so no code assumes a second person.
The surplus earmark logic (`surplus`, `surplusUsed`) is per caller and is unchanged.

### Dependents without login

Defer. Recommendation: this spec does not model dependents. Kids have no account, no money of their
own in the app and no vault, and a goal "for" a child is already expressible as a goal named after
them (its name is encrypted under `K_h`). If the owner later wants a first-class concept it should be
a separate spec with an encrypted `dependents` list and an optional per-goal label (all encrypted
under `K_h`, no plaintext, no login), consistent with the §1.1 text proposed in 197.

### Overlap with specs 198 and 199

Those specs own the goal-detail items section and the household page layout; this spec touches
the same files for copy and member logic. Likely overlaps (confirm when both are drafted):
`goal-item-list.tsx`, `goal-summary.tsx`, `goal-activity.tsx`, `household-overview.tsx`,
`household-setup.tsx`, `invite-partner-dialog.tsx`. Order: land Slice A independently; land Slice B
after 198/199 merge (or rebase over them) to avoid conflicts in those components. Slice A touches
none of the layout files.

## Out of scope

- Leave, remove and `K_h` rotation (spec 197 Option A defers; own later spec).
- First-class dependents (deferred, see above).
- More than four members, multiple households per user, per-goal privacy (every member sees every
  goal by decision).
- Changes to personal vault code or encryption.

## Acceptance

- [ ] Spec 197 approved and committed before any code.
- [ ] A household can accept a 3rd and 4th member; a 5th is rejected ("household is full"); a user
      still cannot join a second household.
- [ ] Any member can add or remove only themself on a goal; a goal always has 1 to 4 members; a
      non-member of the household cannot join a goal.
- [ ] Existing goals keep both current members after migration (backfill).
- [ ] No "Partner" or two-person-only wording remains in the listed files (grep clean), and member
      names render on goal cards.
- [ ] N-way split sums to 100 for 1 to 4 members; payer can be any member; settle-up totals
      balance to zero.
- [ ] The planner deduction for a three-member goal equals the caller's percentage of the monthly
      need.
- [ ] No SQL on encrypted columns; every new action calls `requireUserId()` then
      `getHouseholdKhSession()`; errors are opaque.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green per slice.

## Test plan

- **Migration/RLS** (existing Postgres-backed test pattern, or SQL assertions where the repo
  has them): cap at 4, one-household-per-user, goal-member cap, cross-household join rejected,
  self-only insert/delete, backfill.
- **Unit (vitest, node):** `resolvePayerId` replacement, N-way split helpers (rounding, sums,
  one to four members), per-member settle-up, planner deduction for 1/2/3/4 members, three-writer
  planner-blob guard.
- **Actions:** auth ordering, Zod rejections, opaque errors, last-member-leave rejected.
- **Component (jsdom per file):** goal card member list, join/leave control, N-row split editor
  totals, invite dialog capacity text.
- **Manual/browser** at implementation time with a seeded 3-member household.

## Risk & reversibility

- **Blast radius.** One migration plus household-feature code; personal vaults untouched. The
  riskiest part is the payer/split refactor, which changes stored override shape handling only in
  how it is read (shape stays a user-id keyed map).
- **Rollback.** Slice B reverts independently as code. Slice A: revert code, then a down migration
  restores the 2-member trigger (guarded as above), recreates "Member leaves own row" if it was
  dropped, and drops `household_goal_members`. Contribution and goal data are not modified.
- **Known limitation.** Until the rotation spec, no one can be removed or leave a household;
  a member who joined by mistake needs owner intervention in the database.

## Open questions

- [ ] Q: Slice B after 198/199 merge, or rebase over them? — Owner: Clarence — Recommendation: after.
- [ ] Q: Default goal split: even across the goal's members (recommended) or across the whole
      household? — Owner: Clarence — Recommendation: goal's members.
- [ ] Q: Dependents deferred as proposed? — Owner: Clarence — Recommendation: yes.
- [ ] Q: Should the household owner be able to add another member to a goal, or self-join only?
      — Owner: Clarence — Recommendation: self-join only, per the 2026-11-25 decision.
- [ ] Q: Is `'self'` kept as a transitional alias in the paid-by schema? — Owner: Clarence —
      Recommendation: no; client and server ship together.
