---
id: '175'
slug: household-redesign
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-05
approved: 2026-11-05 # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: 'slice A f99133e' # no PR (direct to main); commit shas recorded per slice
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
  - '§5.2'
  - '§5.4'
  - '§6.3'
constitution_overrides:
---

# Spec 175: Household redesign (goal card, editor sheet, charts, spending budgets)

## Problem

Owner request (2026-11-05): redesign the household UI/UX and its data
visualization. Concrete pain in the shipped feature (specs 149, 150, 161, 162,
171):

- The goal card carries five controls (Add to goal, View details, pencil,
  trash, Add item) around a two-segment You/Partner bar. It says how much is
  saved but not whether the goal is on track, what is already committed to
  items, or what to set aside per month.
- Items, payments, contributions and spending entries can only be added or
  deleted. A typo means delete and re-add (items and payments hold nothing
  else, but re-adding loses the original date and payer).
- The goal detail page (171) cannot edit or delete its goal. It has a
  contributions line chart and a budget-vs-paid bar chart (capped at 8 items)
  that duplicate what the item list already says.
- Shared spending has a free-text category and a top-5 list, no charts, and no
  budget, so a recurring cost that drifts (groceries, utilities) is invisible.

Research used as rationale only, nothing is copied: YNAB targets (a derived
"needed this month" figure), Simplifi goals (on-track state), Monarch couples
(one shared view, a share line), Lunch Money recurring (a monthly target
updated from a rolling average of actuals), Zola budget (estimate, final and
paid per line item; templates of typical items), and the general rule to draft
then save with a delta preview rather than recalculate hidden totals.

## Constitution check

- Satisfies: `§1.1` (household-scoped data only, two linked accounts),
  `§2.1` and `§5.1a` (every new amount, name and category is AES-256-GCM under
  `K_h`; `quote` and `monthly_amount` and the budget `category` are
  ciphertext), `§2.2` (every mutation is a server action in
  `src/features/household/actions/`, no route handler), `§2.3` clause 3 (each
  new or changed action calls `requireUserId()` then `getHouseholdKhSession()`
  before any DB access), `§2.4` (pages stay thin; `goals/[goalId]/page.tsx`
  and `household/page.tsx` only compose feature components), `§2.5` (the
  editor sheet, charts, menus and budget bars are `'use client'` because they
  hold draft state, use Recharts or react to amount masking; the page shells
  stay Server Components), `§2.6` and `§2.7` (new public pieces are exported
  through `src/features/household/index.ts`, named exports only), `§3.1`
  (Recharts, React Hook Form + Zod, TanStack Query, no stack change), `§3.2`
  (no `any`, no inline styles, no inline static data: templates and caps live
  in `constants.ts`), `§3.4` (kebab-case files), `§4.1` to `§4.4` (all five
  gates per slice, tests per slice, no `eslint-disable`), `§4.5` (charts stay
  behind the `src/lib/recharts.tsx` lazy wrapper), `§5.2` (new table ships RLS
  and policies in the same migration; no `GRANT ALL`), `§5.4` (no SQL
  filtering or sorting on `quote`, `category` or `monthly_amount`; matching and
  aggregation happen after decrypt), `§6.3` (migration is additive only).
- Overrides: none.
- HARD rules touched: `§5.2` and `§6.3` only through an additive migration.
  The owner approved that migration in chat on 2026-11-05: a nullable
  encrypted `quote` column and a new `household_spending_budgets` table. See
  the open question on the UPDATE policies that the edit actions additionally
  need.
- Dependencies: none added. `Sheet` and `DropdownMenu` already exist in
  `src/components/ui`. There is no `table.tsx`; the item editor and item table
  are built as semantic `<table>` markup with Tailwind, so no shadcn Table is
  required. If the builder prefers it, `npx shadcn@latest add table` produces
  generated source in `src/components/ui`, not a package dependency, and is
  permitted by `§3.2`.
- `date-fns` is imported only through subpaths (`date-fns/format`,
  `date-fns/parseISO`, ...); ESLint bans bare imports.

## Solution shape

### Data model (one migration, shipped in slice A)

File: `supabase/migrations/20261105000175_household_redesign.sql`. Additive and
idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`).
Nothing existing is altered or dropped.

1. `ALTER TABLE public.household_goal_items ADD COLUMN IF NOT EXISTS quote TEXT;`
   Nullable, encrypted under `K_h`. `NULL` means no final quote yet. The
   existing `budget` column is the estimate.
2. `CREATE TABLE IF NOT EXISTS public.household_spending_budgets`:
   `id UUID PK default gen_random_uuid()`, `household_id UUID NOT NULL
REFERENCES public.households(id) ON DELETE CASCADE`, `category TEXT NOT
NULL` (encrypted under `K_h`), `monthly_amount TEXT NOT NULL` (encrypted
   under `K_h`), `created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE
CASCADE`, `created_at`, `updated_at` (`timestamptz`, utc default, same
   style as the 149 and 150 migrations). Index on `household_id`.
3. RLS enabled in the same migration. Policies mirror the other household
   tables: members of `household_id` (via `public.is_household_member`) can
   SELECT, INSERT, UPDATE and DELETE; INSERT requires `created_by = auth.uid()`.
4. `GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_spending_budgets
TO authenticated;` in the same migration. Migrations 149 and 150 forgot
   their GRANTs and hit `42501` before any policy ran (fixed by
   `20261101000160_household_table_grants.sql`); a test or manual check for
   grants is part of slice A acceptance.
5. Edit support for existing tables (see open question 1): migrations 149 and
   160 granted only SELECT, INSERT, DELETE on `household_goal_items` and
   `household_goal_payments` and created no UPDATE policy. Updating an item or
   a payment therefore needs `GRANT UPDATE` on both tables plus an UPDATE
   policy each, using the same item -> goal -> household membership check as
   the existing policies (payments: `payer_user_id = auth.uid()` in `WITH
CHECK`, matching the INSERT rule so a member cannot reassign a payment to
   the partner). `household_goal_contributions` already has UPDATE (grant and
   policy in `20260627000000_add_household_goals.sql`).

Category matching with encrypted category: the server decrypts every budget
and every spending entry's category with `K_h` inside the request (the same
decrypt-after-fetch path the other household reads use), normalizes with
`category.trim().toLowerCase()`, and matches on the normalized key. Display
uses the first-seen original casing. Two budgets whose normalized keys collide
are rejected at the action boundary (`BUDGET_EXISTS`, opaque message). No SQL
filter, sort or uniqueness constraint touches `category` (`§5.4`).

### Goal card (compact status card)

`components/goal-card.tsx` is rewritten. It shows, top to bottom:

- Name, target date (see timezone fix below), and the status chip.
- One item breakdown bar (same component as the detail page, see Goal detail
  page below): one segment per item sized by its committed amount
  (`effective_i = quote ?? budget`), the paid part of each item shaded, plus a
  remaining-to-target segment (`max(0, target - saved - committed)`, where
  `committed` is the sum over items of `max(0, effective_i - paid_i)`). Items
  beyond `ITEM_BAR_CAP` collapse into "Other" as on the detail page. Segments
  are clamped to 100%. If `saved + committed > target` the committed segments
  take the "over-committed" tint and the label says so. The bar is `w-full`
  inside the card and must stay legible at 375px with no horizontal scroll;
  the card has no labels on the bar (amounts stay in the text lines).
  Funded goals show the existing "Funded" state and a full paid bar.
- Slice A ships this card with a single committed segment in place of the
  per-item segments. Slice B swaps in the per-item segments (see Slice B).
- A "`$X/mo needed`" line from `monthlyPaceNeeded` in `lib/goal-stats.ts`.
  Reuse as is for the number; the existing `'past'` result renders "Past
  target date". No line when funded or when there is no date.
- A `...` overflow menu (shadcn `DropdownMenu`, trigger with
  `aria-label="Goal actions"`) holding Add to goal, Edit, Delete. Delete keeps
  the existing confirm dialog (no undo for goals, unchanged).
- The card body links to `/dashboard/household/goals/[goalId]` using the
  stretched-link pattern: one `<Link>` whose `::after` covers the card, and the
  menu trigger sits above it with `relative z-10`. No `<a>` wraps a `<button>`
  and no button wraps a link, so there is no nested interactive element.

Chip rule (`lib/goal-stats.ts`, new pure `goalStatus(goal, now)`):

1. `remaining <= 0` -> `funded` (chip text "Funded").
2. no `targetDate` -> `no-date` ("No date").
3. `targetDate` before today and `remaining > 0` -> `behind` ("Behind").
4. otherwise compare `saved` with the linear expectation
   `expected = target * elapsedDays / totalDays`, where `elapsedDays` runs from
   the goal's `createdAt` (date part) to today and `totalDays` from `createdAt`
   to `targetDate`, both clamped to at least 1. `saved >= expected` ->
   `on-track` ("On track"); else `behind`. Compare in whole cents.

Dates are parsed with `parseISO` on the `YYYY-MM-DD` slice and formatted with
`date-fns/format`. The current `new Date(<date-only string>)` at
`goal-card.tsx:77` parses as UTC midnight and can render the previous day west
of UTC; it is replaced in the touched code (and in any other spot in the touched
files that does the same).

### Goal editor Sheet (create and edit)

New `components/goal-editor-sheet.tsx` (replaces `create-goal-dialog.tsx`,
`add-item-dialog.tsx` and the add-item flow in `project-breakdown.tsx` for
editing). One shadcn `Sheet`, side `right`, full width at 375px, used for both
create and edit (`goal?: HouseholdGoal` selects the mode).

- Fields: name, `Target amount (SGD)`, target date (optional).
- Item table: rows of name, estimate, final quote (optional). Rows can be
  added and removed. Reorder is deferred (see out of scope); rows keep
  creation order.
- Create mode only: an optional "Start from a template" select (wedding,
  renovation, car) that prefills typical item names with blank amounts. The
  template data is in `constants.ts` (`GOAL_TEMPLATES`), never inline.
- Draft state: all edits live in local React Hook Form state; nothing is
  written until Save. Zod (`schemas.ts`) validates the whole draft, with
  `safeParse` on submit and field errors inline.
- Before commit, Save shows a delta panel: target old -> new, committed total
  old -> new, rows added / changed / removed counts, and a warning listing any
  removed row that already has payments (they are deleted with it by FK
  cascade). A second explicit button, "Confirm and save", commits. Create mode
  shows the same panel with old values blank.
- Add item and Edit on the detail page open this same Sheet.

New action `saveGoal(input)` in `actions/goal-actions.ts` takes
`{ goalId?, name, target, targetDate, items: [{ id?, name, budget, quote? }] }`.
It calls `requireUserId()` then `getHouseholdKhSession()`, parses with Zod,
loads the current items for the goal, and diffs by `id`: rows without `id` are
created, rows with `id` and changed fields are updated, existing rows absent
from the draft are deleted. `quote`, `budget` and `name` are encrypted per row.

Atomicity decision: best effort, ordered, idempotent; no RPC. Order is goal
update, item updates, item inserts, item deletes last. Every step keys on a
stable `id`, so a retry after a mid-way failure converges and cannot duplicate
rows (inserts that succeeded return their ids to the client, which stores them
in the draft). Deletes run last so a failure never loses data early. On any
failure the action returns an opaque error, logs detail server-side only, and
the Sheet stays open with the draft intact and a "Some changes were not saved,
try again" message. An RPC would be fully transactional, but it needs ciphertext
assembled by the server and passed as JSON, a new `SECURITY DEFINER` function
and its own grants and tests, and a household has two users editing a handful
of rows at human speed. The cost of a partial write is a visible, retriable
state, not corruption. If open question 2 goes the other way, only the body of
`saveGoal` changes.

### Edit actions for payments and contributions

- `updateGoalPayment({ paymentId, amount, note, date })` in
  `actions/goal-actions.ts`. Only amount, note and date change; payer and item
  do not. `requireUserId()` then `getHouseholdKhSession()`, Zod at the
  boundary, RLS UPDATE policy from the migration, opaque error text.
- `updateGoalContribution({ contributionId, amount, note, date })`, same
  shape, using the existing UPDATE policy.
- Item rows are updated through `saveGoal`; there is no separate item action.
- UI: an Edit item in the existing row menus (item list, recent activity,
  contributions list) opens a small dialog prefilled from the row. Dialogs reuse
  the add-payment and add-contribution forms with a `mode` prop.

### Goal detail page

- Header gains Edit (opens the editor Sheet) and Delete (confirm dialog, then
  routes to `/dashboard/household`). The stats cards fold You/Partner into one
  share line ("You 60% / Partner 40%"), not a chart.
- Item breakdown bar: one segment per item sized by committed amount
  (`effective_i`), the paid part of each segment shaded. At most
  `ITEM_BAR_CAP = 6` segments; the remainder collapse into an "Other" bucket
  whose tooltip lists the names. The same bar, without labels, is reused on the
  goal card in place of the plain committed segment (open question 5, owner
  decision 2026-11-05). The card must stay legible at 375px with no horizontal
  scroll. This bar is owned by slice B, which also wires it into
  `goal-card.tsx` after slice A lands, so B and C stay file-disjoint.
- Burn-up chart replaces `goal-contributions-chart*.tsx`: cumulative saved
  against a straight needed-pace line from the first contribution (or goal
  creation if none) to the target date. Past the target date the line stops at
  the date and the saved line continues. No target date -> saved line only.
- The budget-vs-paid chart (`goal-items-chart*.tsx`, `ITEM_CHART_CAP`) is
  removed. Each item table row gets an inline bar: estimate, quote and paid on
  one scale, with an over-budget highlight when `paid > effective`.
- All charts and bars go through the `src/lib/recharts.tsx` lazy wrapper where
  Recharts is used; plain CSS bars need no chart library. Every amount shown in
  a chart, tooltip, chip or bar label is wrapped by `useAmountVisibility`
  (`@/features/privacy`) so masking covers the new surfaces, including the
  card's bar labels and the "$X/mo needed" chip.

### Spending budgets (slice C)

- New `actions/budget-actions.ts`: `setCategoryBudget`, `deleteCategoryBudget`
  (each `requireUserId()` then `getHouseholdKhSession()`, Zod, opaque errors)
  and a read `getSpendingBudgets()` that returns decrypted budgets.
- Category picker replaces the free-text category input in the spending
  entry form: a combobox listing budgeted categories first, then previously
  used categories (normalized, de-duplicated), with a "Use new category" row so
  a brand-new category is still allowed.
- Per-category "this month vs budget": horizontal bars (spent against monthly
  amount, over-budget highlighted) on the ongoing space, computed from the
  month's entries by normalized category. Categories without a budget show a
  plain spent figure.
- Suggested budget: for a category, the average of the last 3 full calendar
  months of actual spend in that category (months with no entries count as
  zero; fewer than 3 months of history -> no suggestion). It is only a
  suggestion shown beside the budget field as "Use $X"; the user accepts it
  with one click, which handles price drift. It is recomputed on each view and
  never written without that click. No price-history table.
- The spending log, trips and undo behavior are unchanged.

## Slices

Each slice ships directly to `main` (no PR, solo workflow) with all five gates
green: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
`pnpm build`. B and C start after A and do not share files, so they can run in
parallel.

### Slice A: migration, goal card, editor Sheet, update actions

Owned files:

- `supabase/migrations/20261105000175_household_redesign.sql`
- `src/features/household/types.ts`, `schemas.ts`, `constants.ts`, `index.ts`
- `src/features/household/lib/goal-stats.ts` (`goalStatus`, committed math)
- `src/features/household/actions/goal-actions.ts` (`saveGoal`,
  `updateGoalPayment`, `updateGoalContribution`; read path returns `quote`)
- `src/features/household/components/goal-card.tsx`, `goal-list.tsx`,
  `goal-editor-sheet.tsx` (new), the payment/contribution edit dialogs
- Removed or folded: `create-goal-dialog.tsx`, `add-item-dialog.tsx`,
  `project-breakdown.tsx` add flow (the file stays if it still renders the
  breakdown list used by the detail page until slice B)
- Tests under `test/features/household/`

Acceptance:

- [ ] Migration replays on a fresh DB copy, is idempotent when run twice, and
      grants/policies let an authenticated member read, insert, update and delete
      budgets, and update items and payments of their own household only.
- [ ] Card shows name, date, one bar (single committed segment until slice B),
      `$X/mo needed`, chip, and the overflow menu; no nested interactive elements (test asserts the link
      contains no `button`/`a` descendants and the menu is a sibling).
- [ ] `goalStatus` unit tests cover funded, no-date, past-date, on-track and
      behind, with cent rounding and a goal created today.
- [ ] Editor creates a goal with template items, edits an existing goal, and
      shows the delta panel (old vs new target and committed) before the second
      confirm; failure keeps the draft open.
- [ ] `saveGoal` diff test: create/update/delete mix, retry after a simulated
      mid-way failure yields no duplicates, removed rows with payments are
      flagged, malformed input returns a 400-style flattened error, and server
      errors return an opaque message.
- [ ] `updateGoalPayment` and `updateGoalContribution` tests: auth order
      (`requireUserId` before `getHouseholdKhSession` before DB), Zod rejection,
      ciphertext written, opaque error.
- [ ] Date display fix covered by a test using a timezone west of UTC.
- [ ] Amounts masked on the card bar, chip number and the delta panel.

Existing tests expected to change in A (text or role churn, update in the same
slice): `goal-card.test.tsx`, `goal-list.test.tsx`, `goal-edit.test.tsx`,
`add-item-dialog.test.tsx` (removed with the dialog), `project-breakdown.test.tsx`,
`household-workflows.test.tsx`, `household-overview.test.tsx`,
`goal-actions.test.ts`. Text that moves or changes: "Add item" (becomes the
editor's "Add row" and the detail page action), "Add to goal" (button becomes a
menu item inside Goal actions), "Save changes" (stays on the editor but now
precedes "Confirm and save"), the pencil and trash icon buttons (become "Edit"
and "Delete" menu items). Text that must remain as is: "New goal", "Target
amount (SGD)", "Funded", "Goal reached".

### Slice B: goal detail visuals and actions

Depends on A. Owned files (none shared with C):

- `components/goal-detail.tsx`, `goal-item-list.tsx`, `goal-detail-skeleton.tsx`
- `components/goal-card.tsx`: only the swap of the single committed segment for
  the item breakdown bar (after A lands; no other card change is B's)
- new `components/goal-burn-up-chart.tsx` and `-chart-content.tsx`, new
  `components/item-breakdown-bar.tsx`
- removed: `goal-contributions-chart*.tsx`, `goal-items-chart*.tsx`,
  `ITEM_CHART_CAP` and `itemChartRows` if unused
- `lib/goal-stats.ts` additions are limited to new pure functions
  (`burnUpSeries`, `breakdownSegments`) appended without touching A's
  functions; if both slices need the same file in parallel, A lands first
- `src/app/dashboard/household/goals/[goalId]/page.tsx` (composition only)
- Tests: `goal-detail.test.tsx`, `goal-charts.test.tsx`,
  `goal-item-list.test.tsx`, `goal-stats.test.ts`

Acceptance:

- [ ] Detail shows Edit (opens the A editor Sheet) and Delete (confirm, then
      navigate to the household page).
- [ ] Breakdown bar: one segment per item sized by committed amount, paid part
      shaded, more than `ITEM_BAR_CAP` items collapse into "Other"; zero items
      shows the empty summary. The same bar appears on the goal card at 375px
      without horizontal scroll.
- [ ] Burn-up shows saved vs needed pace, handles no date, no contributions
      (starts at creation), and a past target date.
- [ ] Old contributions line chart and budget-vs-paid chart are gone; each item
      row has an inline estimate/quote/paid bar with over-budget highlight.
- [ ] Single You/Partner share line replaces the split bar in the stats.
- [ ] Editing a payment or contribution from the detail page works end to end.
- [ ] Amounts masked in chart tooltips, axes, bar labels and the share line.

### Slice C: spending budgets

Depends on A (migration). Owned files (none shared with B):

- `actions/budget-actions.ts` (new), `schemas.ts` additions are limited to
  budget schemas appended at the end; if A is still open, rebase on it
- `components/shared-spending.tsx`, `spending-summary.tsx`, new
  `components/category-picker.tsx`, `components/category-budget-bars.tsx`,
  `components/budget-field.tsx`
- `lib/spending-stats.ts` (new: `normalizeCategory`, `monthVsBudget`,
  `suggestedBudget`)
- Tests: `shared-spending.test.ts`, `shared-spending-view.test.tsx`, new
  `budget-actions.test.ts`, `spending-stats.test.ts`, `category-picker.test.tsx`

Acceptance:

- [ ] Budget CRUD actions follow the auth order, validate with Zod, return
      opaque errors, and reject normalized duplicate categories.
- [ ] Category picker lists budgeted then previously used categories and still
      accepts a new one; a case or whitespace variant maps to the existing key.
- [ ] "This month vs budget" bars use the correct month and highlight
      over-budget; unbudgeted categories show spend only.
- [ ] Suggestion equals the mean of the last 3 full calendar months for that
      category, is absent with less than 3 months of history, and is never saved
      without the user's click.
- [ ] Amounts masked on the bars, budget field and suggestion text.
- [ ] Existing log, trip and undo-delete behavior unchanged.

## Out of scope

- A price-history table; recurring is a monthly target with a rolling-average
  suggestion only.
- Per-partner budgets, per-member split rules, or approval flows.
- Auto-detected recurring transactions or merchants.
- Item reordering (drag or move up/down). Rows keep creation order; deferred.
- Editing spending entries or space names (only budgets are new in C).
- Lazy-loading recharts on the dashboard route as a bundle follow-up.
- Notifications, reminders or alerts for behind or over-budget states.
- Any change to household key handling, invite flow or `K_h` wrapping.

## Acceptance (whole spec)

- [ ] `pnpm format:check`, `pnpm lint` (max-warnings 0), `pnpm typecheck`,
      `pnpm test:ci`, `pnpm build` green at the end of each slice.
- [ ] No `any`, no `console.log`, no `eslint-disable` or `@ts-ignore`, no new
      dependency, no inline static data in components.
- [ ] Spec frontmatter updated per slice (`impl_pr` lists shas) and `status:
shipped` only when A, B and C are on `main`.
- [ ] Manual, household unlocked, amounts masked and then unmasked, at desktop
      width and at 375px: goal list, create via template, edit with delta
      panel, goal detail (both charts replaced, inline bars, share line), edit a
      payment and a contribution, delete a goal, spending budgets and the
      category picker. No horizontal scroll, the card menu is reachable by
      keyboard, no console errors, masked state shows no digits in charts.
- [ ] Spec hash matches at implementation time (spec unchanged since approval).

## Risk & reversibility

- **Blast radius**: household goals and spending UI for the two linked
  accounts; the migration adds one nullable column, one table and UPDATE
  policies. Personal vault data is not touched.
- **Test churn**: about nine household test files assert on role and label
  text; slice A updates them in the same commit as the UI change, so `main` is
  never red.
- **Nested interactive card**: the stretched-link pattern must keep the menu
  trigger above the link in stacking and focus order; a test and the 375px
  check cover it.
- **Timezone date display**: `new Date('YYYY-MM-DD')` at `goal-card.tsx:77`
  shifts a day west of UTC; fixed with `parseISO` in the touched code.
- **Partial saves**: the best-effort `saveGoal` can leave some rows written.
  Mitigated by ordering, idempotent ids and a retriable draft.
- **Reversibility**: code slices revert with `git revert`. The migration is
  forward-only and additive (`§6.3`); leaving the column and table unused after
  a revert is harmless. Rolling it back needs a separate, backed-up migration
  spec.
- **Backout plan**: revert the slice commits newest first (C, B, A); keep the
  migration applied.

## Open questions

- [x] Q1: The edit actions need `GRANT UPDATE` and UPDATE policies on
      `household_goal_items` and `household_goal_payments`, which the owner's
      migration approval did not name. Proposed default: include them in the
      slice A migration as additive RLS (membership-gated, payer fixed). Owner:
      Clarence. A: Accepted proposed default (Clarence, 2026-11-05).
- [x] Q2: Is best-effort ordered `saveGoal` acceptable, or does the owner want
      a transactional RPC? Proposed default: best effort, as justified above.
      Owner: Clarence. A: Accepted proposed default (Clarence, 2026-11-05).
- [x] Q3: On-track rule is linear from creation date to target date. Does the
      owner prefer pace against the last 3 months of actual contributions?
      Proposed default: linear. Owner: Clarence. A: Accepted proposed default
      (Clarence, 2026-11-05).
- [x] Q4: Templates (wedding, renovation, car): confirm item names. Proposed
      default: wedding = Venue, Catering, Photography, Attire, Rings; renovation
      = Design, Materials, Labour, Furniture, Contingency; car = Deposit,
      Insurance, Registration, Accessories. Owner: Clarence. A: Accepted
      proposed default (Clarence, 2026-11-05).
- [x] Q5: Should the item breakdown bar also appear on the goal card? Proposed
      default: no, the card keeps the single committed segment; the detail page
      has the full breakdown. Owner: Clarence. A: Yes: card shows the item
      breakdown bar (cap per Q6) in place of the single committed segment, per
      owner decision 2026-11-05.
- [x] Q6: Item breakdown cap. Proposed default: 6 segments plus "Other".
      Owner: Clarence. A: Accepted proposed default (Clarence, 2026-11-05).
- [x] Q7: Suggested budget with fewer than 3 full months of history: show
      nothing, or average the months available? Proposed default: show nothing.
      Owner: Clarence. A: Accepted proposed default (Clarence, 2026-11-05).
