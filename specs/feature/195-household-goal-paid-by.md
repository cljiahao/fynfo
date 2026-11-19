---
id: '195'
slug: household-goal-paid-by
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-19
approved: 2026-11-19 # owner-approved in chat 2026-11-19 ("Approve, build it"), open questions as drafted
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes: # none; reverses the "payer/contributor is the caller" rule of specs 149 and 175
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.4'
  - '§3.1'
  - '§4.1'
  - '§5.1a'
  - '§5.2'
  - '§6.3'
constitution_overrides: []
---

# Spec 195: Log household goal payments and contributions on behalf of the partner

## Problem

Goal item payments (`household_goal_payments.payer_user_id`) and goal
contributions (`household_goal_contributions.contributor_user_id`) are forced to
the logged-in user. The action layer writes `userId` into the column
(`addItemPayment`, `addContribution` in
`src/features/household/actions/goal-actions.ts`) and RLS rejects anything else
(`payer_user_id = auth.uid()` on INSERT in
`20261023000149_household_project_items.sql`, `contributor_user_id = auth.uid()`
on INSERT in `20260627000000_add_household_goals.sql`, and on UPDATE USING and
WITH CHECK in `20261105000175_household_redesign.sql`). When the spouse paid a
vendor or transferred money, the spouse has to log in to record it, or the entry
is attributed to the wrong person and the "You" / "Partner" split on the goal
detail is wrong.

### Why the earlier rule is reversed

The pin to `auth.uid()` was chosen so a member could not forge entries in the
partner's name and so an entry's author could not be reassigned (the
`20261105000175` comment: "a payment cannot be reassigned to the partner").
That protected against a partner the household does not trust. Fynfo households
are two linked accounts of one couple (spec 052, `CONSTITUTION.md` §1.1); both
already hold `K_h` and can read, insert and delete every goal row (the DELETE
policies already check membership only, not authorship). The pin therefore never
stopped a partner from removing or re-creating an entry; it only forced the
paper trail to name the author. The owner has decided the convenience of
recording for the spouse outweighs that.

## Owner decisions (2026-11-19, in chat)

1. Scope is item payments AND goal contributions. Shared spending
   (`household_spending`) is out of scope.
2. Either household member may create, edit and delete any goal payment or
   contribution, including changing who paid. A member can record for the other
   member without that member logging in.

## Constitution check

- Satisfies:
  - `§2.1` and `§5.1a`: amounts and notes stay sealed under `K_h`; the payer and
    contributor id is an existing plaintext column, so there is no crypto change
    and nothing new is stored in plaintext.
  - `§2.2`, `§2.3`: mutations stay in `goal-actions.ts` server actions, which
    keep calling `requireHouseholdContext()` (user id, DEK session, `K_h`)
    before any DB access.
  - `§2.4`: the picker lives in feature components; pages are unchanged.
  - `§3.1`, `§4.1`: unit and SQL regression tests land in the same impl PR.
  - `§5.2`: RLS stays on; the new rule is enforced in the database, not only in
    the action.
  - `§6.3`: one new forward-only, non-destructive migration; no prior migration
    is edited.
- Overrides: none. Governance spec 052 (two-person household) is relied on, not
  amended: membership remains the trust boundary.

## Solution shape

### Database (new migration, forward-only)

A new migration `supabase/migrations/<timestamp>_household_paid_by.sql` replaces
four policies with `DROP POLICY IF EXISTS` then `CREATE POLICY`, touching no
data and no columns:

- `household_goal_payments`
  - INSERT `WITH CHECK`: item belongs to a goal in the caller's household
    (unchanged join) AND `payer_user_id` is a member of that same household.
  - UPDATE `USING`: item belongs to a goal in the caller's household (the
    authorship check is removed). `WITH CHECK`: same, plus `payer_user_id` is a
    member of that household, so `payer_user_id` may change but only to a member.
  - DELETE is already membership-only; left as is.
- `household_goal_contributions`: the same three rules against
  `household_goals.household_id`.

The existing `is_household_member(p_household_id)` helper only tests
`auth.uid()`, so the migration adds a second helper
`public.is_household_user(p_household_id UUID, p_user_id UUID)`: `SECURITY
DEFINER`, `SET search_path = public`, same shape as `is_household_member` (it
reads `household_members` as owner to avoid the policy recursion described in
`20260626000000_add_household.sql`), `REVOKE ALL ... FROM PUBLIC`, `GRANT
EXECUTE ... TO authenticated`. It returns only a boolean and reveals nothing the
caller could not already learn: a user id is only meaningful to a caller who
already reads that household's roster.

### Action layer

- `schemas.ts`: `addItemPaymentSchema`, `addContributionSchema`,
  `updateGoalPaymentSchema`, `updateGoalContributionSchema` gain an optional
  `paidBy: z.enum(['self', 'partner']).optional()`, treated as `'self'` on
  create when absent.
- The client does not know the partner's user id (the roster is not exposed to
  the UI; the goal views only carry `isSelf`). The input therefore names a role
  and the server resolves it. This is a deliberate change from sending a raw
  user id: a client-supplied uuid would be untrusted input to validate, while a
  role resolved server-side cannot name a non-member by construction.
- A small helper in `goal-actions.ts` (for example
  `resolvePayerId(supabase, householdId, userId, paidBy)`) returns `userId` for
  `'self'` and the other `household_members.user_id` for `'partner'`. If the
  household has no second member it throws an `AppError` with an opaque message.
  The database check above remains the backstop (`§5.2`).
- `addItemPayment` and `addContribution` write the resolved id instead of
  `userId`. `updateGoalPayment` and `updateGoalContribution` include
  `payer_user_id` / `contributor_user_id` in the update only when `paidBy` is
  provided, so an edit that does not touch the picker leaves the attribution
  unchanged. The doc comments saying the payer / contributor never changes are
  updated.
- Errors stay opaque (`AGENTS.md` §4): `throwIfSupabaseError` is unchanged and no
  Postgres text reaches the client. A rejected `payer_user_id` surfaces as the
  existing generic failure; the zero-rows `NOT_FOUND` path on update is
  unchanged.
- `getGoals` `isSelf` mapping (`payer_user_id === userId`,
  `contributor_user_id === userId`) already reflects the stored id and needs no
  change: an entry the owner records for the spouse shows as "Partner" to the
  owner and as "You" to the spouse.

### UI

- `add-contribution-dialog.tsx`, the payment entry reached from
  `goal-item-list.tsx`, and `edit-payment-dialog.tsx` (payments and
  contributions) gain a "Paid by" control with the options "You" and "Partner",
  matching the labels already used in `goal-activity.tsx` and
  `goal-item-list.tsx`. The household has no display-name field, so no new name
  source is introduced.
- Defaults to "You" on create; defaults to the entry's current `isSelf` value on
  edit.
- Shown only when the household has two members (`memberCount === 2`, already on
  the household summary the goal views use); hidden for a one-member household,
  where the field is omitted and the server defaults to the caller.
- Existing display of the payer in the activity feed and item payment list is
  unchanged.

## Out of scope

- Shared spending (`household_spending`) and category budgets.
- Per-member display names, avatars, or a roster API to the client.
- Goal, item and budget-line create/edit/delete rules (already membership-only).
- Any change to encryption, key wrapping, or `K_h` handling.
- An audit trail of who recorded versus who is credited.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build` green
- [ ] With two members, creating a payment or contribution with "Partner" stores
      the partner's user id; it shows as "Partner" to the creator and "You" to the
      partner
- [ ] Omitting `paidBy`, or choosing "You", stores the caller's id (no behaviour
      change for existing flows)
- [ ] Either member can edit a payment or contribution recorded by the other,
      including changing who paid, and can delete it
- [ ] An edit that omits `paidBy` leaves `payer_user_id` / `contributor_user_id`
      unchanged
- [ ] "Partner" in a one-member household is rejected with an opaque error
- [ ] The "Paid by" picker is hidden unless the household has two members
- [ ] Spec hash matches at impl PR time

## Test plan

- **Unit (Vitest)**, `src/features/household`:
  - Schemas accept `paidBy` of `self` / `partner` / absent and reject any other
    value, including a raw uuid.
  - Actions: `addItemPayment` and `addContribution` write the caller id for
    `self` and the other member's id for `partner`; a one-member household with
    `partner` throws and does not insert; update actions include the id column
    only when `paidBy` is set.
  - Components: the picker renders with two members and not with one; default
    selection is "You" on create and the current payer on edit; the submitted
    payload carries `paidBy`.
- **RLS (SQL regression script)** in `supabase/tests/195-household-paid-by.sql`,
  same format as `149-household-project-items.sql` (synthetic local stack, rolls
  back), with two members and one outsider:
  - Member inserts a payment and a contribution with the partner as payer /
    contributor: allowed.
  - Member inserts with the outsider as payer / contributor: rejected.
  - Member inserts with a member of a different household: rejected.
  - Either member updates an entry authored by the other, including reassigning
    the payer / contributor to the other member: allowed; reassigning to the
    outsider: rejected.
  - Either member deletes the other's entry: allowed.
  - Outsider cannot read, insert, update or delete.

## Risk & reversibility

- **Blast radius**: goal payments and contributions in two-member households;
  four RLS policies and one new helper function.
- **Trust change (accepted by the owner)**: a partner can now create entries in
  your name and edit or delete entries you recorded, including changing who paid.
  Delete was already open to both members; edit and attribution now match it.
  There is no audit trail of who recorded an entry.
- **Reversibility**: the migration is non-destructive and adds no data. Reverting
  means a new forward migration restoring the `auth.uid()` pins; existing rows
  already carry valid member ids, so none are invalidated. The helper can remain
  unused.
- **Backout plan**: revert the impl PR for the code; ship a restoring migration
  for the policies if the rule is withdrawn.

## Open questions

None. Decisions recorded above by the owner on 2026-11-19. One design choice
worth a glance at approval: the input names a role (`self` / `partner`) rather
than a client-supplied user id, because the client has no roster.
