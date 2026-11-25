---
id: '199'
slug: household-page-simplify
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-25
approved: 2026-11-25 # YYYY-MM-DD, set on approval
shipped: 2026-11-25 # YYYY-MM-DD, set on impl merge
impl_pr: # link to impl PR, set on shipped
supersedes: # none
constitution_satisfies:
  - '§1.1'
  - '§2.3'
  - '§2.4'
  - '§2.6'
  - '§2.7'
  - '§3.4'
  - '§4.1'
constitution_overrides:
  - section: '§2.5'
    reason: 'Both pages render interactive, query-driven household views that are already client components; the new route page is a thin Server Component composing one client feature component.'
---

# Spec 199: Simplify the household page, move shared spending to its own route

## Problem

`/dashboard/household` carries two tabs (Goals, Spending), a plan summary, a
planner split editor and per-goal explanatory text on every goal card. The
owner wants the page to be just the goal cards plus the household invite (spec
196 `InvitePartnerDialog`), with shared spending reachable on its own page.
Today the Spending tab competes with goals for the same header, and the header
button swaps between `New goal` and `Add spending` (`household-overview.tsx`).

## Constitution check

- Satisfies:
  - `§1.1`: household membership cap and scope unchanged; this only
    reorganises navigation.
  - `§2.3`: no new server actions; existing reads and mutations keep their
    `requireUserId()` then DEK gate.
  - `§2.4`: the new `page.tsx` composes a feature component and fetches
    nothing, like `dashboard/household/page.tsx`.
  - `§2.6`, `§2.7`: the new component is a named export through the
    `src/features/household` barrel.
  - `§3.4`: kebab-case file names, route folder `spending/page.tsx`.
  - `§4.1`: all five `pnpm` gates run before review.
- Overrides: `§2.5` (SOFT) as in the front matter; no new client boundary
  beyond components that are already `'use client'`.

## Solution shape

Data unchanged; no migration; no new dependency.

### Household page (`/dashboard/household`)

- `components/household-overview.tsx`: remove `Tabs`, `VIEWS`, the `view`
  state and the Spending `TabsContent`. Render, in order: header with the
  invite action and member-count copy (spec 196 behaviour unchanged), a link to
  shared spending (below), then the goals area (`GoalList`, create sheet, load
  and error states kept).
- Header action: keep `New goal`; drop the `Add spending` branch and the
  `QUICK_ADD_AMOUNT_ID` focus helper from this component.
- Per-goal explanation text removed from `components/goal-card.tsx`: the
  `Budget lines exceed the target` note and the `/mo of the monthly plan` pace
  line. Title, progress bar, paid/target figures and status chip stay. The page
  header description is shortened to goals only.
- `HouseholdPlanSummary` and `PlannerSplitEditor` placement is Q1; resolved: they move
  below the goal cards into a `Monthly plan` disclosure, collapsed by default,
  with no logic change.
- Locked state, setup flow (`HouseholdSetup`), `HouseholdSurplusReporter` and
  `household-with-savings.tsx` are untouched.

### Shared spending route

- New `src/app/dashboard/household/spending/page.tsx` (Server Component, no
  fetching) rendering a new client view, plus `loading.tsx` using
  `HouseholdSkeleton`.
- New `src/features/household/components/household-spending-view.tsx`
  (`'use client'`, justified: uses `useHousehold`, `useSpaces`,
  `useUnlockHousehold`, the unlock/locked UI and `UndoableDeleteProvider`). It
  reproduces what the removed tab did: locked and setup guards, spaces loading
  and error states, `<SharedSpending spaces=... />`, and the `Add spending`
  header button that focuses `QUICK_ADD_AMOUNT_ID`. A back link to
  `HOUSEHOLD_PATH` mirrors `goal-detail.tsx`.
- `constants.ts`: add `HOUSEHOLD_SPENDING_PATH = `${HOUSEHOLD_PATH}/spending``.
The navbar `Household` item (`dashboard-navbar.tsx`, `exact: false`) stays
active on the sub route; confirm whether `PAGE_ROUTES` needs an entry.
- The household page links to `HOUSEHOLD_SPENDING_PATH` with a clear
  `Shared spending` link (owner decision; style in Q2).
- Extract the lock/setup guard into one small shared component if copying it
  would exceed a few lines.
- `shared-spending.tsx`, `spending-actions.ts` and `lib/shared-spending.ts` are
  not edited.

### Files touched (ownership)

Owned by 199: `components/household-overview.tsx`, `components/goal-card.tsx`
(explanation text removal), `components/household-spending-view.tsx` (new),
`src/app/dashboard/household/spending/{page,loading}.tsx` (new), `constants.ts`
(path constant only), `components/index.ts` and `index.ts` barrels, and tests.

Shared with spec 198: `components/goal-card.tsx` (198 may rename the
contribute label only; 199 owns every other edit) and `constants.ts` (198 adds
`GOAL_ITEM_VISIBLE_ROWS`, 199 adds `HOUSEHOLD_SPENDING_PATH`; separate lines).
199 does not touch `goal-detail.tsx`, `goal-item-list.tsx`,
`add-goal-item-dialog.tsx`, `goal-actions.ts`, `schemas.ts`, `types.ts` or
migrations, which 198 owns. Spec 200 owns payer picker components.

## Out of scope

- Goal detail page changes (spec 198) and payer work (spec 200).
- Any change to shared spending features, data, categories or budgets.
- Redirects from an old tab state (tabs were local state, not in the URL).
- Planner, plan summary maths or `goal-stats.ts`.
- Database or action changes.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` green
- [ ] `/dashboard/household` has no tabs; shows goal cards, the invite action
      (owner with a free seat) and a visible link to shared spending
- [ ] Goal cards show no per-goal explanation lines
- [ ] `/dashboard/household/spending` renders the previous Spending tab
      content, handles locked, no-household, loading and error states, and links
      back
- [ ] Navbar `Household` item stays active on the spending route
- [ ] Invite behaviour from spec 196 unchanged on the household page
- [ ] No file owned by spec 198 is modified
- [ ] Spec hash matches at impl PR time

Test plan (vitest, node default, `// @vitest-environment jsdom` per file for
component tests, under `test/features/household/`):

- Update the existing overview and invite tests: no `tablist`, spending link
  `href`, invite still renders.
- Update `goal-card.test.tsx`: explanation lines absent, core figures present.
- New `household-spending-view.test.tsx` (jsdom): locked, loading, error and
  loaded states, back link, `Add spending` focus.

## Risk & reversibility

- **Blast radius**: household page layout, goal card copy, one new route. No
  data, crypto or action paths.
- **Reversibility**: single git revert; no migration.
- **Backout plan**: revert the impl commit.

## Open questions

Resolved 2026-11-25 (owner told the orchestrator to proceed with the
recommended defaults).

- [x] Q1: "Per-goal explanation text" is read as the goal-card pace and
      over-committed lines. Do `HouseholdPlanSummary` and `PlannerSplitEditor`
      stay above the cards, move to the spending page, or go? — Owner:
      Clarence — A: Yes, remove the pace and over-committed lines. The page is
      goal cards plus invite, so `HouseholdPlanSummary` and
      `PlannerSplitEditor` move below the cards into a `Monthly plan`
      disclosure that is collapsed by default.
- [x] Q2: Spending link style: header button next to `New goal`, or a card
      below the goals? — Owner: Clarence — A: Header button next to the spec 196
      invite button.
- [x] Q3: Is `/dashboard/household/spending` the final path? — Owner:
      Clarence — A: Yes, final. `src/proxy.ts` only whitelists public paths, so
      the route is protected without a change.
