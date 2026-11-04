---
id: '171'
slug: household-goal-detail
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-04
approved: 2026-11-04 # YYYY-MM-DD, set on approval
shipped: 2026-11-04
impl_pr: no PR (direct to main), aa29aaa 82b472b ce0fde9 258a22f (impl/171-household-goal-detail)
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.4'
  - '§2.5'
  - '§2.6'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§4.3'
  - '§4.4'
  - '§4.5'
  - '§5.1a'
  - '§5.4'
constitution_overrides:
---

# Spec 171: Household goal detail page and modal budget items

## Problem

Owner request, verbatim: "for the household page, i would love that the
breakdown to add budget items is a button that adds in modal. if not if i add a
lot the rows expands a lot. i was thinking if we can also click into the card to
open its own page to show charts and trends etc of the household spending. like
more stats too. keep it minimalist and easy to add or use."

Today every goal card on `/dashboard/household` carries its full budget
breakdown inline (`project-breakdown.tsx`): an expandable list of every item with
its payments, plus an always-visible inline add-item form
(`project-breakdown.tsx:150-215`). A project goal with many items (a wedding with
20 lines) makes the card, and so the whole Goals tab, grow without bound. There
is also nowhere to see how a goal is trending: the card only shows a progress bar
and totals, and the data needed for trends (dated contributions and dated item
payments) is already loaded but never charted.

Owner decisions (2026-11-04):

1. The detail page is for **goal** cards only. Spending-tab spaces and trips are
   unchanged.
2. On the goal card the Breakdown section collapses to a one-line summary plus an
   "Add item" button that opens a modal (name + budget). The full item list,
   per-item payments, pay, delete and undo move to the detail page.

## Constitution check

- Satisfies:
  - `§1.1` household-scoped data only; no personal vault data is touched.
  - `§2.1` / `§5.1a` no new data is stored or sent. Everything rendered is
    already decrypted in the existing goals query; no new plaintext leaves the
    client and no key handling changes.
  - `§2.2` the modal reuses the existing `addGoalItem` server action. No route
    handler is added. The new route is a read-only page.
  - `§2.3` (exception 3) unchanged: the only server calls are the existing
    household actions, which already do `requireUserId()` then
    `getHouseholdKhSession()`. The detail page adds no new action.
  - `§2.4` `src/app/dashboard/household/goals/[goalId]/page.tsx` is a thin
    composer of `GoalDetail` from the `@/features/household` barrel. The only
    page-level code is reading the `goalId` route param and passing it down; no
    data fetching in the page.
  - `§2.5` the page file stays a Server Component. `'use client'` is justified
    for `GoalDetail` and the chart components: they read the React Query cache
    (`useGoals`), amount-visibility state and open dialogs, exactly as
    `HouseholdOverview` does. Charts are lazy-loaded behind `next/dynamic`.
  - `§2.6` / `§2.7` `GoalDetail` is exported through
    `src/features/household/components/index.ts` and `src/features/household/index.ts`;
    all new exports are named. `page.tsx` and `loading.tsx` use the Next.js
    default-export exception.
  - `§3.1` Recharts via the existing lazy wrapper `src/lib/recharts.tsx`; no new
    dependency.
  - `§3.2` Tailwind only (no inline styles beyond recharts' own prop objects
    already used by `CHART_TOOLTIP_PROPS`); static copy and chart config live in
    `constants.ts`; no `any`, no `console.log`.
  - `§3.4` kebab-case files, PascalCase components, UPPER_SNAKE_CASE constants.
  - `§4.1` - `§4.4` gates (`pnpm check`, `pnpm test:ci`, `pnpm build`) and no
    suppressions without a spec note.
  - `§4.2` new pure helpers (cumulative series, monthly pace, per-item chart
    rows, summary text) get unit tests; no server action or schema changes, so the
    `src/features/*/actions/` coverage floor is unaffected.
  - `§4.5` the new route's JS stays within budget because recharts loads in a
    lazy chunk only on this route; the household page itself gets lighter, since
    the inline item list and form leave the card.
  - `§5.4` no SQL, no filtering or sorting on encrypted columns; all
    aggregation is client-side after decryption, as today.
- Overrides: none.
- No HARD rule is touched, so no `governance/` spec is required. No migration, no
  new server action, no new dependency, no cryptographic change (§7.4 exclusions
  do not apply and this spec is a normal feature spec awaiting approval).

### Data sufficiency (verified against the code at `5338f38`)

`useGoals` (`use-household.ts`, `GOALS_KEY = ['household-goals']`) returns
`HouseholdGoal[]` (`types.ts:28-75`) already carrying everything the detail page
needs: `contributions[{ id, amount, note, date, isSelf }]`, `contributed`,
`remaining`, `pct`, `targetAmount`, `targetDate`, `createdAt`,
`items[{ id, name, budget, payments[{ id, amount, note, date, isSelf }], paid,
remaining, over }]`, `budgeted`, `paid`. The query is fully client-side
(decrypted in `getGoals`). Therefore the detail page selects its goal from the
cached list by id and derives every stat and chart series in the browser: **no
migration, no new server action, no new dependency**. The existing mutation hooks
(`useAddGoalItem`, `useAddItemPayment`, `useDeleteGoalItem`,
`useDeleteItemPayment`, `useAddContribution`) already invalidate `GOALS_KEY`, so
the detail page and the list stay consistent without extra wiring.

## Solution shape

### Route and shell

- `src/app/dashboard/household/goals/[goalId]/page.tsx`: Server Component. Awaits
  `params` (Next.js 16 async params) and renders `<GoalDetail goalId={goalId} />`
  in the same wrapper `div` as `household/page.tsx`.
- `src/app/dashboard/household/goals/[goalId]/loading.tsx`: renders a
  `GoalDetailSkeleton` (exported from the feature barrel), mirroring
  `HouseholdSkeleton`.
- `src/proxy.ts` already protects `/dashboard/**`; no change expected (to be
  confirmed during implementation by reading the matcher, not edited).

### `GoalDetail` (`src/features/household/components/goal-detail.tsx`)

State handling reuses `HouseholdOverview`'s logic so the two pages never
disagree:

- Household loading: `GoalDetailSkeleton`. Household error: same "Couldn't load
  your household" block with retry.
- No household: link back to `/dashboard/household` (which hosts setup).
- Locked household: the same unlock affordance as `HouseholdOverview`
  (`useUnlockHousehold`), extracted into a small shared component if that avoids
  duplicating more than ~15 lines; otherwise a short "Unlock on the Household
  page" notice with a link. Implementer picks the smaller diff; behavior is
  specified, the factoring is not.
- Goals loading/error: skeleton / the existing goals-error treatment.
- Goal id not in the list (unknown, deleted in another tab, or another
  household's id): empty state "Goal not found" with a back link. No
  `notFound()` call is possible because the lookup depends on client-only,
  decrypted data; this is intentional and noted for reviewers. The page is never a
  hard 404, which also avoids confirming whether an id exists.
- Deleting the goal from the detail page is **not** offered (kept on the card,
  where Edit/Delete already live); fewer destructive paths on the new page.

Layout, mobile first (375px), single column, `space-y-6`:

1. **Header.** Back link "Goals" (44px target, `ChevronLeft`) to
   `/dashboard/household`. Then goal name (`h1`, masked via `mask()`), "by dd MMM
   yyyy" when `targetDate` exists, `ProgressBar` with `pct`, and a one-line "You
   $X · Partner $Y" split computed from `contributions` by `isSelf`.
2. **Stat cards** (existing `StatCard` from `@/components/widgets`, 2x2 grid on
   mobile, 4 across at `lg`):
   - Contributed (`contributed` of `targetAmount`).
   - Remaining (`remaining`; tone `gain` once funded).
   - Paid vs budgeted (`paid` of `budgeted`; tone `loss` when `paid > budgeted`;
     hidden entirely when there are no items).
   - Monthly pace needed: `remaining / max(1, ceil(months until targetDate))`;
     shows "Past target date" when the date has passed and `remaining > 0`, and
     "-" when there is no target date or the goal is funded. Pure helper
     `monthlyPaceNeeded(goal, now)` in `lib/goal-stats.ts`.
3. **Contributions over time** chart (omitted with a one-line empty hint when
   there are no contributions): `LineChart` of cumulative contributions by date
   (`contributions` sorted ascending, one point per contribution date,
   same-day sums merged), with a dashed `ReferenceLine` at `targetAmount`. Line
   `var(--chart-2)`, reference line `var(--muted-foreground)`. Pure helper
   `cumulativeContributions(goal)` in `lib/goal-stats.ts`. Height 220px mobile.
4. **Budget vs paid** chart (only when `items.length > 0`): horizontal grouped
   `BarChart`, one row per item, bars for budget (`var(--chart-3)`) and paid
   (`var(--chart-2)`); an item with `over > 0` renders its paid bar with
   `Cell fill="var(--loss)"` and the table below carries the over-budget text so
   colour is never the only signal (WCAG 1.4.1). Rows capped at the 8 largest by
   budget with a "+N more" caption to keep the chart minimalist; the item list
   below remains complete. Pure helper `itemChartRows(goal, cap)`.
5. **Items** section: heading "Budget items", an "Add item" button (opens the
   shared modal, below), and the full item list moved verbatim from
   `ProjectBreakdown`: `ItemRow` with pay form, payment list, delete and the
   existing `useUndoableDelete` + `ConfirmDeleteDialog` behavior, always
   expanded (no toggle needed on a dedicated page). `ItemRow` and its helpers are
   extracted from `project-breakdown.tsx` into `goal-item-list.tsx` and imported
   by both files' remaining consumers, so no code is duplicated.
6. **Recent activity**: last 8 entries merged from contributions ("You added
   $X") and item payments ("Partner paid $X to Venue"), newest first, with date.
   Pure helper `recentActivity(goal, limit)`. Uses `isSelf` for the wording, no
   new identity data.

Charts live in `goal-contributions-chart.tsx` + `goal-contributions-chart-content.tsx`
and `goal-items-chart.tsx` + `goal-items-chart-content.tsx`, following the
`dividend-income-chart.tsx` / `dividend-income-chart-content.tsx` split:
the outer file is the `next/dynamic` boundary (`ssr: false`, `Skeleton` with a
reserved height), the `-content` file imports from `@/lib/recharts` and spreads
`CHART_AXIS_TICK_PROPS` and `CHART_TOOLTIP_PROPS`.

### Amount masking

`useAmountVisibility` covers every new surface, following the existing pattern
(`mask()` for text and `hidden` for charts):

- Stat values, header split, activity list amounts and item names go through
  `mask()`.
- Both chart content components return the existing short placeholder paragraph
  ("... chart hidden") when `hidden`, so no axis tick, bar length, line position
  or tooltip can leak a value while masked (same approach as
  `DividendIncomeChart`). Axis `tickFormatter` and tooltip `formatter` use
  `formatSGDWhole` only in the unmasked branch.
- The add-item modal fields are disabled and cleared while `hidden`, with
  `canReveal()` guarding input, exactly as the current inline form does.

### Goal card changes (`goal-card.tsx`, `project-breakdown.tsx`)

- `ProjectBreakdown` is reduced to a compact summary row (rename to
  `BreakdownSummary` only if the diff stays clearer; otherwise keep the name):
  - Items exist: `"N items · $paid of $budget"` (masked via `mask()`); tone `loss`
    plus the text "over budget" when `paid > budgeted`.
  - No items: `"Split into budget items"`.
  - A right-aligned "Add item" button (`variant="outline"`, `size="sm"`, 44px
    touch target via the existing `TOUCH_TARGET` technique) opens
    `AddItemDialog`.
- The inline expand/collapse toggle, item list, payment forms and inline add form
  leave the card.
- **Navigation to the detail page.** The goal name in the card `h2` becomes a
  `next/link` to `/dashboard/household/goals/{id}`, plus a visible "View details"
  text link with chevron (min 44px target) in the card footer row. The whole
  `Card` is deliberately **not** a link or button: the card already contains
  Edit, Delete, Add contribution and Add item buttons, and nested interactive
  elements are invalid HTML and a screen-reader and keyboard trap (a link
  wrapping buttons, or buttons inside a `role="button"` card). A real anchor with
  an accessible name ("View details for {mask(name)}") gives correct semantics,
  middle-click/open-in-new-tab, and a single clear focus stop. If the owner wants
  a larger visual target, a stretched-link (`after:absolute after:inset-0` on the
  title link with the other buttons raised via `relative z-10`) is the acceptable
  upgrade, and is listed in Open questions.
- Heading level and the other card behaviors from spec 162 (celebrate, funded
  border, masked title) are unchanged.

### `AddItemDialog` (`src/features/household/components/add-item-dialog.tsx`)

- shadcn `Dialog`, structured like `create-goal-dialog.tsx` /
  `add-contribution-dialog.tsx`: props `{ goal: HouseholdGoal; open: boolean;
onOpenChange: (open: boolean) => void }`.
- Fields: Item name (`maxLength` 80) and Budget (`type="number"`, `min="0"`,
  `step="0.01"`, right-aligned, `tabular-nums`). Inline `FieldError` with
  `aria-invalid` / `aria-describedby` via the same `invalidProps` helper
  (extract to `lib/form-errors.ts` if shared by more than one file).
- Submit uses the existing `useAddGoalItem()` hook and existing `addGoalItem`
  action with unchanged Zod schema (`name` 1-80 trimmed, `budget` positive
  finite). Client-side validation messages are reused from the current inline
  form so behavior is identical.
- Behavior: autofocus the name field; submit on Enter; "Add item" primary button
  disabled while pending or `hidden`; on success close the modal, reset fields,
  and toast. A secondary "Add another" is **not** included (minimalism); the
  button on the card or page re-opens the modal in one tap. On error the modal
  stays open with entered values and the existing opaque error toast.
- The same dialog component is used by the goal card and by the detail page, so
  there is one add-item path.

### Constants and files

- `constants.ts`: route builder `GOAL_DETAIL_PATH = (id: string) =>
\`/dashboard/household/goals/${id}\``, chart height, item-chart cap (8), recent
  activity limit (8), summary strings.
- New: `goal-detail.tsx`, `goal-detail-skeleton.tsx`, `goal-item-list.tsx`,
  `add-item-dialog.tsx`, the four chart files, `lib/goal-stats.ts`,
  `app/dashboard/household/goals/[goalId]/{page,loading}.tsx`.
- Edited: `goal-card.tsx`, `project-breakdown.tsx`, `components/index.ts`,
  `features/household/index.ts`, `constants.ts`.
- Encryption-touching code paths: none new. `getGoals` decrypt and
  `addGoalItem` encrypt paths are reused unchanged.

## Out of scope

- Detail pages for Spending-tab spaces and trips.
- Editing a goal, deleting a goal, or adding contributions from the detail page
  (they stay on the card; the detail page only adds items and records item
  payments, which are the actions that moved off the card).
- Editing an existing budget item (name/budget); no such action exists today.
- Any migration, server action, schema, RLS or key-handling change; any new
  dependency.
- Deep links that survive a locked household (the unlock flow keeps the user on
  the current page; no redirect-back logic).
- Persisting the selected Goals/Spending tab across navigation. Back returns to
  `/dashboard/household`, which defaults to the Goals tab, matching the only
  entry point for this feature.
- Export/printing, per-person budget attribution, notifications.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint` (max-warnings=0), `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new tests (plan below) pass and fail on a deliberate
      regression of each helper
- [ ] `pnpm build` green; the new route appears in the build output and recharts
      is only in the lazy chunk
- [ ] Manual (375px and desktop, light and dark): goal card with 0, 1 and 20
      items keeps constant height; "Add item" modal adds an item and the summary
      updates without a reload; tapping the card title or "View details" opens the
      detail page; Back returns to the Goals tab
- [ ] Manual: toggling amount privacy hides every stat value, chart, axis tick,
      tooltip, item name and activity amount on both card and detail page
- [ ] Manual: an unknown goal id shows the "Goal not found" state with a working
      back link; locked household on the detail page offers unlock and then
      renders the goal
- [ ] Manual: keyboard-only pass: card has one link focus stop for navigation, the
      modal traps focus and restores it to the "Add item" button on close, all new
      targets are at least 44px
- [ ] Spec hash matches at impl PR time

### Test plan

Unit (node env, pure helpers in `lib/goal-stats.ts`):

- `cumulativeContributions`: ordering, same-day merge, empty, single point.
- `monthlyPaceNeeded`: future date, date today, past date, no date, funded.
- `itemChartRows`: cap with remainder count, over-budget flag, zero items.
- `recentActivity`: merge/sort across contributions and payments, `isSelf`
  wording, limit.
- Summary string helper: empty ("Split into budget items"), N items with totals,
  over budget.

Component (jsdom per file, per the repo's test infra):

- `AddItemDialog`: opens from the card button, validates empty name and
  non-positive budget with `aria-invalid` and `FieldError`, submits through a
  mocked `addGoalItem`, closes and resets on success, stays open and keeps values
  on failure, fields disabled and empty while amounts are hidden.
- `GoalCard` summary states: no items, with items, over budget (loss tone and
  "over budget" text), masked (no amounts in DOM text), link has the accessible
  name and the correct href, no interactive element nested in another.
- `GoalDetail`: renders with items and without items (items chart and Paid stat
  hidden, "Add item" still present), pay/delete/undo flows delegate to the moved
  `ItemRow`, goal not found state, loading, locked, and no-household states.
- Masking of charts: with `hidden` true both chart content components render the
  placeholder and no recharts nodes (mock `@/lib/recharts`, assert no `Tooltip`,
  `XAxis`, `YAxis` rendered); with `hidden` false they receive `formatSGDWhole`
  formatters.
- Existing `project-breakdown` tests are migrated to cover `goal-item-list` and
  the summary row; none are deleted without an equivalent.

## Risk & reversibility

- **Blast radius**: household Goals tab and one new read-only route. No data
  model, server, or key changes, so no data-loss or leakage class risk beyond the
  masking surface, which is covered by tests above. Highest-risk item is
  accidentally leaking amounts through chart ticks/tooltips; mitigated by
  returning the placeholder when masked rather than masking inside recharts.
- **Reversibility**: a single git revert restores the inline breakdown; no
  migration rollback.
- **Backout plan**: `git revert` the implementation commit(s) on `main`; verify
  `/dashboard/household` renders the inline breakdown. No cache or data cleanup
  is needed because the React Query key and payload shapes are unchanged.

## Open questions

- [x] Q1: Make the whole card clickable (stretched link) in addition to the title
      and "View details" link? — Owner: Clarence — Recommended default: no; keep
      the explicit title link plus "View details". It is accessible, avoids
      accidental taps on mobile where the card also holds four buttons, and a
      stretched link can be added later in one class change.
- [x] Q2: Should paying an item (recording a payment) be possible from the goal
      card summary, or only on the detail page? — Owner: Clarence — Recommended
      default: detail page only, as decided; the card keeps just the "Add item"
      modal button to stay minimal.
- [x] Q3: Monthly pace: should "months remaining" count the current partial month
      as a full month (pace is lower, slightly optimistic) or round down (higher,
      conservative)? — Owner: Clarence — Recommended default: ceil the remaining
      months, minimum 1, so the figure never understates what is needed.
- [x] Q4: Cap the budget-vs-paid chart at the 8 largest items with a "+N more"
      note, or chart every item? — Owner: Clarence — Recommended default: cap at
      8; the full list is directly below and a 20-bar chart is unreadable at
      375px.
