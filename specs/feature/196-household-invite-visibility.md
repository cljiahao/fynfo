---
id: '196'
slug: household-invite-visibility
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-25
approved: 2026-11-25 # owner-approved in chat 2026-11-25 ("Approve all defaults"), all open-question defaults taken
shipped: 2026-11-25 # YYYY-MM-DD, set on impl merge
impl_pr: none (direct to main, 3abd2f1)
supersedes: # none
constitution_satisfies:
  - '§1.1'
  - '§2.1'
  - '§2.3'
  - '§2.4'
  - '§3.1'
  - '§5.1a'
constitution_overrides: []
---

# Spec 196: Make "Invite partner" discoverable on the household page

## Problem

The owner cannot find how to invite his partner on `/dashboard/household`.
`InvitePanel` (`src/features/household/components/invite-panel.tsx`) is an
inline card that only renders when all of these hold
(`household-overview.tsx`):

- `household.data.role === 'owner'` and `memberCount < HOUSEHOLD_MEMBER_CAP`
  (`showInvite`), and
- the household is unlocked (the whole tab area is gated on `!locked`), and
- the Goals tab is active, and
- `goals.data` has loaded (a goals read error hides it), and
- it sits in the page body between `HouseholdPlanSummary` and `GoalList`, which
  is easy to scroll past and is not where users look for an account-level action.

So it is invisible on the Spending tab, while locked, and when goals fail to
load, and it never explains its own absence once the household is full or the
viewer is not the owner.

## Constitution check

- Satisfies:
  - `§1.1` (household exception): membership stays capped at two. This spec
    changes where the invite action is surfaced, not who may join or how many.
  - `§2.1`, `§5.1a`: the invite flow is untouched. `createInvite` still unwraps
    `K_h` with the owner's DEK, wraps it under a key derived from a
    high-entropy one-time secret, stores only the hash, and returns the secret
    once. No plaintext, key material or crypto parameter changes.
  - `§2.3`: no action changes. `createInvite` already calls
    `requireActionContext()` (user id then DEK) before any DB access.
  - `§2.4`: the button and dialog live in `src/features/household/components/`;
    the page file is unchanged.
  - `§3.1`: component tests land in the same impl change.
- Overrides: none. No `HARD` rule is touched; no governance spec is needed.

## Findings from the code (design adjusted)

1. **`createInvite` does not need the household unlocked.** It uses
   `requireActionContext()` (personal DEK) and `unwrapKh(member.wrapped_kh, dek)`
   read straight from `household_members`; it never reads the
   `fynfo_household_kh` cookie. "Locked" in the UI only means that cookie is
   absent. The original idea (locked click either explains or triggers unlock)
   is therefore unnecessary: the invite works while the household is locked, as
   long as the personal vault is unlocked (which the dashboard already
   requires). The adjusted design shows a working button in the locked state
   too, with no unlock prompt.
2. `PageHeader`'s `action` is a single `ReactNode` wrapped in one `div`; the
   header action currently renders only when `!locked`. Two buttons need a flex
   wrapper (`flex items-center gap-2`), and the existing goal/spending button
   keeps its `!locked` condition while the invite button does not.
3. `src/components/ui/dialog.tsx` exists (shadcn `Dialog`, `DialogContent`,
   `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`). No new
   dependency.
4. `HouseholdSummary` (`types.ts`) already carries `role`, `memberCount` and
   `locked`; no new data or action is needed to decide any of the four states.
5. The secret must not outlive the dialog. Today `secret` is component state
   inside `InvitePanel`, which stays mounted. In a dialog the state must be
   cleared when the dialog closes, so reopening shows the "Generate" step, not a
   stale, already-shared secret.

## Solution shape

### Components (`src/features/household/components/`)

- New `invite-partner-dialog.tsx`: exports `InvitePartnerDialog`, a
  self-contained component that renders the trigger button and the dialog.
  - Trigger: `Button variant="outline"` with a `UserPlus` icon and the label
    "Invite partner", so it reads as secondary to the primary New goal / Add
    spending button.
  - Dialog content is the body of today's `InvitePanel`, moved unchanged in
    behaviour: intro text and "Generate invite code" button; after mint, a
    read-only `Input` (`aria-label="One-time invite code"`), a copy icon button
    (`aria-label="Copy invite code"`), the share-once / 48 hour warning, and the
    same toasts. `useCreateInvite` is reused as is.
  - `DialogTitle` "Invite your partner"; `DialogDescription` carries the intro
    sentence.
  - On close, `secret` is reset to `null` (see Finding 5). The mutation state is
    reset with it.
- Delete `invite-panel.tsx` (its body moves into the dialog; no other consumers,
  to be confirmed with a grep in the impl). Remove the `InvitePanel` import,
  the inline `{showInvite && <InvitePanel />}` and the Goals-tab placement from
  `household-overview.tsx`.
- New small `household-members-note.tsx` (or inline in `household-overview.tsx`,
  implementer's choice): renders the muted membership note described below.

### Overview wiring (`household-overview.tsx`)

`PageHeader` `action` becomes a flex group:

- Invite control, outside the `!locked` condition and independent of `view`,
  `goals.data` and `hidden` (amount hiding does not apply: the invite carries no
  amounts):
  - `role === 'owner'` and `memberCount < HOUSEHOLD_MEMBER_CAP`:
    `<InvitePartnerDialog />`.
  - `memberCount >= HOUSEHOLD_MEMBER_CAP`: no button; a muted note
    "2 of 2 members" (`text-muted-foreground text-xs`), computed from
    `memberCount` and `HOUSEHOLD_MEMBER_CAP`, not hardcoded.
  - `role !== 'owner'` and `memberCount < HOUSEHOLD_MEMBER_CAP`: no button; a
    muted note "Only the owner can invite a partner". (A non-owner member of a
    one-member household cannot normally exist, but the branch costs nothing and
    keeps the explanation honest.)
- Existing New goal / Add spending button: unchanged, still `!locked` only.

The `showInvite` constant is replaced by a three-way derivation (`canInvite`,
`isFull`, `ownerOnlyNote`) so the states are explicit and unit-testable.

### Locked state

The button shows and works while locked (Finding 1). The "Household locked"
panel and its "Unlock household" button are unchanged. No copy about unlocking
is added to the dialog.

### Copy

All new strings say "partner". The two-member cap is unchanged.

### Data, API, encryption

No migration, no schema change, no action change, no new env, no dependency.
Encryption-touching path: `createInvite` is called exactly as before; only its
caller moves.

## Out of scope

- More than two members. That needs a `CONSTITUTION.md` §1.1 amendment via a
  `governance/` spec first; `HOUSEHOLD_MEMBER_CAP` stays 2.
- Revoking or listing pending invites, resending, or changing the 48 hour TTL.
- Changing `createInvite`, `acceptInvite`, the invite hash or the key wrapping.
- The accept-invite / join flow and `HouseholdSetup`.
- Redesigning `PageHeader`.
- Showing display names or the partner's identity (the household has no
  display-name field).

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` green
- [ ] Owner with a free seat: "Invite partner" button is visible in the header on
      both the Goals and Spending tabs
- [ ] Owner with a free seat while locked: button visible; generating a code
      works without unlocking
- [ ] Full household (owner or member view): no invite button; "2 of 2 members"
      note visible
- [ ] Non-owner with a free seat: no button; owner-only note visible
- [ ] Goals tab no longer renders the inline invite card
- [ ] Dialog: Generate calls `createInvite` once and shows the code; Copy writes
      the secret to the clipboard and toasts; closing and reopening shows the
      Generate step again with no leftover secret
- [ ] Manual: as owner of a one-member household, find the button without
      scrolling on both tabs; generate and copy a code
- [ ] Spec hash matches at impl time

## Test plan

New file `test/features/household/invite-partner.test.tsx`, first line
`// @vitest-environment jsdom` (vitest default is node; jsdom is per file, as in
`budget-field-split-failure.test.tsx`), with `@testing-library/jest-dom/vitest`,
a `QueryClientProvider`, and `vi.mock` of the household actions module (the
pattern the neighbouring tests use). `HouseholdOverview` is rendered with the
`useHousehold`, `useGoals` and `useSpaces` hooks mocked or their actions mocked.

- Owner, `memberCount 1`, unlocked: button present with Goals active, and still
  present after switching to Spending.
- Owner, `memberCount 1`, `locked: true`: button present; New goal absent.
- Owner, `memberCount 2`: no button; "2 of 2 members" present.
- Member (not owner), `memberCount 1`: no button; owner-only note present.
- Goals tab with goals loaded: no inline "Invite your partner" card.
- Dialog flow: click trigger, click Generate, `createInvite` called once, code
  input shows the mocked secret; click Copy, `navigator.clipboard.writeText`
  called with the secret; close dialog, reopen, Generate step shown and secret
  gone.
- Clipboard rejection shows the error toast (existing behaviour preserved).

## Risk & reversibility

- **Blast radius**: client UI of one page. No data, crypto or server changes.
  The one behavioural risk is a leftover secret persisting across dialog opens,
  covered by the reopen test.
- **Reversibility**: a single `git revert`; no migration.
- **Backout plan**: revert the impl commit; the inline `InvitePanel` returns.

## Open questions

Each has a recommended default; approving with "all defaults" accepts every one.

- [x] Q1: Button style. Outline "Invite partner" beside the primary button, or
      the primary style? — Owner: Clarence — Default: outline, so New goal /
      Add spending stays the primary action.
- [x] Q2: Locked state. Show the working invite button while locked (the code
      shows it needs only the personal DEK), or hide it until unlocked as the
      original idea left open? — Owner: Clarence — Default: show it and let it
      work while locked.
- [x] Q3: Full household note wording. "2 of 2 members" alone, or
      "2 of 2 members. Your partner has joined"? — Owner: Clarence — Default:
      "2 of 2 members".
- [x] Q4: Non-owner note wording. "Only the owner can invite a partner". —
      Owner: Clarence — Default: that wording.
- [x] Q5: Keep a short pointer inside the Goals tab empty state or plan summary
      for an owner who has not invited yet? — Owner: Clarence — Default: no;
      the header button on both tabs is enough, and a second entry point is
      extra surface to maintain.
- [x] Q6: Delete `invite-panel.tsx` outright (body moves into the dialog), or
      keep it as the dialog's inner component? — Owner: Clarence — Default:
      delete and move the body into `invite-partner-dialog.tsx`; one component,
      no dead file.
