---
id: '189'
slug: household-goal-detail-redesign
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-15
approved: 2026-11-15 # owner-approved in chat 2026-11-15 as drafted, all recommended defaults
shipped: 2026-11-16 # YYYY-MM-DD, set on impl merge
impl_pr: https://github.com/cljiahao/fynfo/pull/78 # link to impl PR, set on shipped
supersedes: # none; refines the page built by 171 and changed by 175 and 187
constitution_satisfies:
  - '§2.1'
  - '§2.4'
  - '§2.5'
  - '§2.6'
  - '§2.7'
  - '§3.1'
  - '§3.4'
  - '§4.1'
  - '§5.1a'
constitution_overrides: []
---

# Spec 189: Household goal detail redesign

## Problem

The owner finds the per-goal page (`/dashboard/household/goals/[goalId]`)
"pretty bad to view as a human: difficult to view and not visually pleasing".
Reading the rendered structure shows why: four equal-weight stat tiles give no
single number to look at; the only progress bar in the header shows how the
budget items fill the target, not how much has been saved; the status and
deadline that the goal card shows are missing; each budget item is a 12px,
three-lane bar with no legend and 12px text controls; Edit and Delete sit side
by side with equal weight and squeeze the title at 375px; the page is one
undifferentiated column of identically styled headings, with the actionable
items list below a chart. This spec is a presentation-only refinement. It keeps
the incumbent identity (OKLCH tokens, shadcn/ui, you/partner two-tone) and every
existing function.

The critique was code-based: a live run needs a two-account unlocked household
and real Supabase credentials, which this slice does not use. The structure was
reconstructed from the components listed under "Files".

## Constitution check

- Satisfies: `§2.1` and `§5.1a` (no data leaves the browser; masking stays a
  display layer and now also covers the new bars, percent and chart
  placeholder), `§2.4` (the page stays a thin composer; no data fetching moves
  into it), `§2.5` (the new components are client components only because
  `GoalDetail` already is; no new boundary is added, justified by existing
  hooks and `useAmountVisibility`), `§2.6` / `§2.7` (barrel import
  `@/features/household`, named exports only), `§3.1` (no dependency or version
  change), `§3.4` (kebab-case file names), `§4.1` (all five gates).
- Overrides: none. No HARD rule is touched. No server action, migration,
  schema, crypto or dependency change.
- Authorization: owner request in chat. Approved 2026-11-15.

## Critique (impeccable `critique`, Operate mode, incumbent-preserving)

Mode: Operate (dashboard app UI). `impeccable context` reported no PRODUCT.md or
DESIGN.md and a narrow-refinement allowance, so the incumbent code is the design
authority. Neither file is created here.

### Heuristic scores (0-4)

- Visibility of system status: 2. No status chip, no time-left or overdue cue,
  saved-vs-target is not drawn as a bar.
- Match with the real world: 2. "Burn-up", "Saved vs needed pace", "Share of
  monthly plan", "Budget items" mixed with "Paid"/"Contributed".
- User control and freedom: 3. Undo-delete and confirm dialog are good.
- Consistency and standards: 2. The card has a status chip and an actions menu;
  the detail page has neither and exposes Delete as a peer button.
- Error prevention: 3. Item limit, masking guard, `canReveal()` are sound.
- Recognition over recall: 2. The three-lane item bar needs a legend it lacks.
- Flexibility and efficiency: 2. No "Add to goal" on the page that is about the
  goal; "Record payment" is a 12px text link.
- Aesthetic and minimalist design: 1. Four identical tiles, flat sections,
  12px text for the main task controls, payments listed twice.
- Error recovery: 3. Opaque toasts, undo window.
- Help and documentation: 2. Empty states are one muted line each.

Total 22 / 40 (acceptable-poor; major rework of hierarchy and grouping).

### Ranked findings

P1 (blocks comfortable use):

1. No primary number. `goal-detail.tsx:272-306` renders four `StatCard`s
   (`stat-card.tsx:51-67`, each `text-2xl font-bold` in a Card) of equal weight,
   including a sentence-valued one. The eye has nowhere to land.
2. Progress to target is not visible. The header bar (`goal-detail.tsx:269`,
   `item-breakdown-bar.tsx`) sizes segments by item amount with the paid part
   shaded, on a scale of `max(target, items total)` (`breakdownSegments`,
   `goal-stats.ts:236-265`); it never shows saved. The you/partner split is one
   muted text line (`goal-detail.tsx:307-311`), although two-tone colors exist
   (`PERSON_COLORS`, `constants.ts:13-16`).
3. Budget item rows are hard to read. Three 4px lanes (estimate, quote, paid)
   packed into a `h-3` track with no legend (`goal-item-list.tsx:153-183`),
   `text-xs` meta, a link-style `Record payment` (`:193-206`), and every payment
   as a `text-xs` row with two icon buttons always visible (`:267-327`).
4. Status and deadline are weak or absent. The target date is a `text-sm`
   muted "by dd MMM yyyy" (`goal-detail.tsx:235-240`); `goalStatus`
   (`goal-stats.ts:177-206`) and the overdue case the card surfaces
   (`goal-card.tsx:95-107`) are not shown on the page.

P2 (degrades quality):

5. Order and density. The chart precedes the actionable items list; all `h2`s
   are the same unstyled `font-semibold` (`goal-detail.tsx:314-399`); desktop is
   one narrow column with unused width.
6. Header actions. Edit and Delete are equal outline buttons beside the title
   (`goal-detail.tsx:230-268`); at 375px the name is squeezed, and a destructive
   action sits one pixel from the primary edit. There is no way to add a
   contribution from the page (only edit existing ones via activity).
7. The pace tile puts sentences ("Past target date", "Nothing to set aside")
   into a `text-2xl` numeric slot (`goal-detail.tsx:292-305`) and uses jargon.
8. Chart. Jargon heading (`:315`); hidden state is one line where a 220px chart
   was (`goal-burn-up-chart-content.tsx:28-31`), shifting layout; the legend
   explains the dashed line in prose only (`:105-114`).
9. Recent activity repeats payments already listed under items and does not use
   the person colors (`goal-detail.tsx:367-398`).

P3 (polish):

10. `goal-detail-skeleton.tsx:5-22` shows a header, four tiles and a chart only;
    the loaded page jumps when items and activity appear.
11. Empty states are single muted sentences (`goal-detail.tsx:357-359, 368`).
12. The over-commit warning is `text-xs` and floats under the section heading
    (`goal-detail.tsx:347-353`); the same fact is also a red line under the bar.

### Decisions from earlier specs that are kept

- 171/175: items and chart data, `ItemBreakdownBar` as the one shared component
  (still used, now in the items section, labels on), burn-up chart through
  `src/lib/recharts.tsx`, split of contributions as a share line (now drawn as a
  bar plus legend, same numbers), Edit opening the 175 editor Sheet, Delete with
  confirm then route to `HOUSEHOLD_PATH`, undo-delete for items and payments.
- 187: names masked everywhere; stable component tree; `min-h-10` or larger
  touch targets, `pointer-coarse:min-h-11`; amounts `whitespace-nowrap`.
- 175's "the detail page cannot edit or delete" was superseded by 175 itself;
  nothing here reverses it.
- Reversed (called out): the three-lane per-item bar becomes one lane plus text
  (finding 3), and the "You x% / Partner y%" muted line becomes a bar plus
  legend. Both carry the same data.

## Solution shape

All edits are inside `src/features/household/` plus tests. Use existing tokens
and Tailwind classes only; no new CSS variables, no new fonts, no new
dependencies.

### Hierarchy rules

- The single primary number is **Saved** (`goal.contributed`), `text-3xl
font-semibold tabular-nums`, with "of {target}" in `text-sm
text-muted-foreground` and a right-aligned percent (`goal.pct`, `text-sm
font-medium tabular-nums`).
- Secondary facts: Remaining, Paid out (only with items), Monthly share. They
  are `text-lg font-semibold tabular-nums` with `text-xs text-muted-foreground`
  labels. No tile border or Card per fact.
- Tertiary: item rows, activity, chart. Meta text is `text-xs` only for dates
  and hints, never for a control.
- One family (the app's sans), type steps limited to: `text-3xl` (primary),
  `text-2xl` (page title), `text-lg` (secondary fact), `text-base` (section
  heading, item name), `text-sm` (body), `text-xs` (meta).
- Section headings: `h2`, `text-base font-semibold`, with an optional count in
  `text-sm font-normal text-muted-foreground`. Spacing between sections
  `space-y-8` on `lg`, `space-y-6` below; inside a section `space-y-3`.
- Containers: one Card (summary) plus bordered lists (`rounded-xl border`
  with `divide-y`) for items, activity and the chart wrapper (`rounded-xl
border p-3 sm:p-4`). Never nest a bordered box in another.

### Page structure, top to bottom (DOM order = mobile order)

1. **Header** (`<header>`): back link `Goals` (existing `BackLink`); title row
   with `h1 text-2xl font-semibold break-words` and the actions; meta row under
   the title.
   - Meta row: status chip (hidden while amounts are hidden, as on the card;
     same classes as `goal-card.tsx:95-107`: `rounded-full px-2 py-0.5
text-[11px] font-medium`, `bg-gain-subtle text-gain-strong` for
     funded/on-track, `bg-destructive/10 text-destructive` for behind,
     `bg-muted text-muted-foreground` for no-date, a `Check` icon when funded,
     label from `GOAL_STATUS_LABEL`) then the deadline text from the new
     `goalDeadline`: "Target 31 Dec 2026 · 5 months left" in `text-sm
text-muted-foreground`; overdue and not funded: "Target 31 Oct 2026 ·
     Overdue by 15 days" with the "Overdue" part `text-loss-strong`; funded:
     only "Target 31 Dec 2026"; no date: no deadline text.
   - Actions: `Add to goal` (primary `Button size="sm"`, `Plus` icon, opens the
     existing `AddContributionDialog` in add mode via `contribution={null}`
     and `goal={goal}`; see open question 1), `Edit` (outline, as today) and a
     ghost icon `Goal actions` `DropdownMenu` trigger (`MoreHorizontal`,
     `aria-label="Goal actions"`, `pointer-coarse:size-11`, the same pattern as
     `goal-card.tsx`) containing one item `Delete goal` (`text-destructive`,
     with `Trash2`) that opens the existing `ConfirmDeleteDialog`. All three are
     `disabled={hidden}` and guard with `canReveal()` exactly as the current
     buttons do.
2. **Summary** (`<section aria-label="Goal summary">`, one `Card`):
   - Row: "Saved" label `text-sm text-muted-foreground`; under it the primary
     number and "of $target"; percent on the right.
   - Progress bar `h-3 rounded-full bg-muted overflow-hidden` drawn as an
     inline SVG like the other bars: two consecutive rects sized
     `contributed_you / target` and `contributed_partner / target` (clamped to
     100% total) with `PERSON_COLORS.you.fill` (`fill-brand`) and
     `PERSON_COLORS.partner.fill` (`fill-chart-4`), `stroke-background`
     between. When funded and over target the bar is full. The track renders
     while amounts are hidden; fills do not (they would leak the percent).
   - Legend row under the bar (`text-xs`, `flex flex-wrap gap-x-4 gap-y-1`): a
     `size-2 rounded-full` dot from `PERSON_COLORS.*.dot`, "You $X (60%)" and
     "Partner $Y (40%)", each wrapped in `mask(...)`. Shown only when
     `contributed > 0`.
   - Facts row: `grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3`, separated
     from the bar by `border-t pt-4 mt-4`. Facts: **Remaining** (`goal.remaining`;
     `text-gain` and hint "Target reached" when funded and not hidden),
     **Paid out** (`goal.paid`, hint "of {budgeted} budgeted"; `text-loss` when
     `paid > budgeted` and not hidden; hidden entirely when there are no
     items), **Monthly share** (label kept from today's "Share of monthly
     plan"; see open question 2). Monthly share value states: numeric `pace`
     renders `{mask(formatSGD(pace))}/mo` at `text-lg`; non-numeric states
     ("Past target date", "Nothing to set aside", "-") render at `text-sm
text-muted-foreground`, not at `text-lg`, so a sentence never sits in a
     numeric slot. Hidden: `mask('')`.
   - Over-commit note (`role="status"`, only when `!hidden && overCommitted`):
     a row `rounded-lg bg-warning-subtle text-warning-strong px-3 py-2 text-sm`
     with the existing sentence ("Saved plus items still to pay total $X, above
     the $Y target."). It replaces the `text-xs text-warning` paragraph, and the
     page passes `showOverNote={false}` to `ItemBreakdownBar` so the red line
     under the bar is not repeated; the fact is stated once.
3. **Budget items** (`<section aria-labelledby="items-heading">`):
   - Heading row: `h2` "Budget items" + count; right: `Add item` outline
     `sm` button (unchanged behavior: `disabled={hidden || itemLimitReached}`,
     title and `sr-only` reason retained).
   - Under the heading, when items exist: `<ItemBreakdownBar goal={goal}
labels />` (moved out of the header, where it sat above unrelated stats).
   - List: `<ul className="divide-y rounded-xl border">`; each `<li>` is
     `p-3 sm:p-4 space-y-2`.
   - Row line 1: name `text-base font-medium truncate` left; right
     `tabular-nums` "paid / effective" (`text-sm`, effective in muted) and the
     delete-item ghost icon button (kept, `pointer-coarse:size-11`).
   - Row line 2: one lane, `h-2 rounded-full bg-muted overflow-hidden`; paid
     rect on scale `max(effective, paid)`; fill `fill-primary`, `fill-loss`
     when over. Estimate and quote are no longer separate lanes: they become
     text (below). Track only while hidden.
   - Row line 3 (`text-xs`, `flex flex-wrap items-center justify-between
gap-2`): left text `{left} left` or `Over by {over}` (`text-loss-strong`),
     then, when a quote exists, ` · Quote {quote} vs est. {budget}` (masked).
     Right: `Record payment` as an outline `Button size="sm"` (`min-h-9
pointer-coarse:min-h-11`), no longer a link variant at `text-xs`. When
     `paying`, the existing inline form replaces it unchanged
     (`grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]` at `sm`; at 375px
     stack as `grid-cols-2` with Save/Cancel on a second row).
   - Payments: collapsed behind a disclosure button `N payments` (`text-xs`,
     `ChevronDown` rotating with `aria-expanded`, `aria-controls` the list id,
     `min-h-9 pointer-coarse:min-h-11`), hidden when there are none, default
     collapsed. Expanded rows keep today's content (date, You/Partner, amount,
     edit and delete icon buttons with the existing aria-labels and 44px
     `TOUCH_TARGET`), with a person dot from `PERSON_COLORS`.
   - Empty (no items): replace the muted sentence with a dashed container
     (`rounded-xl border border-dashed py-8 text-center`) holding "No budget
     items yet" (`font-medium`), "Split this goal into items to track what is
     paid." (`text-sm text-muted-foreground`) and the same `Add item` action.
4. **Progress over time** (`<section aria-labelledby="burn-up-heading">`,
   heading renamed from "Saved vs needed pace"): wrapper `rounded-xl border
p-3 sm:p-4`; chart height `h-[220px]` (unchanged, also the lazy
   placeholder). Legend becomes two swatches in one row: solid `bg-[var(--chart-2)]`
   "Saved" and a dashed muted swatch "Needed pace to the target date" (only when
   `hasPace`). Hidden state: the same 220px box with centered text "Chart hidden
   while amounts are hidden" so nothing shifts; the chart and its tooltip are
   not mounted, as today. No contributions: the same box with "Add to the goal
   to start the chart".
5. **Recent activity** (`<section aria-labelledby="activity-heading">`):
   `<ul className="divide-y rounded-xl border">`, rows `px-3 py-2.5 sm:px-4`,
   `text-sm`: person dot (`PERSON_COLORS`), text from `activityText`
   (unchanged strings), date `text-xs text-muted-foreground tabular-nums`
   (`dd MMM yyyy`), edit icon button (unchanged label and 44px target). Empty:
   "No activity yet. Add to the goal or record a payment to see it here."
   inside the same bordered container, `text-sm text-muted-foreground`, `p-4`.

### Layout

- Below `lg` (including 375px): one column in the order above, container
  unchanged (`max-w-site mx-auto w-full px-4 py-6 sm:px-6 sm:py-8` in
  `page.tsx`, not edited).
- At `lg`: header and summary span the full width; sections 3 to 5 sit in
  `grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8` with
  Budget items in the left column (`lg:row-span-2`) and Progress over time then
  Recent activity stacked in the right column. DOM order is unchanged, so
  keyboard and screen-reader order matches the mobile order.
- Nothing may scroll horizontally at 375px; every name is `min-w-0` with
  `truncate` or `break-words`; every amount is `shrink-0 whitespace-nowrap`.

### Text wireframes

Desktop (>= 1024px):

```
< Goals
Japan trip 2027                          [+ Add to goal] [Edit] [...]
[On track]  Target 31 Dec 2027 - 13 months left
+------------------------------------------------------------------+
| Saved                                                       62%  |
| $6,200  of $10,000                                               |
| [#### you ####][## partner ##]-------------------------------   |
| o You $3,720 (60%)   o Partner $2,480 (40%)                      |
| ---------------------------------------------------------------  |
| Remaining $3,800     Paid out $4,100        Monthly share        |
|                      of $9,000 budgeted     $292/mo              |
+------------------------------------------------------------------+
Budget items (4)                  [+ Add item]  | Progress over time
[ item breakdown bar + labels ]                 | +----------------+
+---------------------------------------------+ | |  line chart    |
| Flights              $1,800 / $2,200   [t]  | | +----------------+
| [=========-------]                          | | o Saved - - Needed pace
| $400 left - Quote $2,200 vs est. $2,000     | | Recent activity
|                          [Record payment]   | | +----------------+
| v 2 payments                                | | | o You added $500|
|---------------------------------------------| | |   03 Nov 2026 /|
| Hotel ...                                   | | +----------------+
+---------------------------------------------+
```

375px:

```
< Goals
Japan trip 2027
[On track]  Target 31 Dec 2027
13 months left
[+ Add to goal]  [Edit]  [...]
+--------------------------+
| Saved                62% |
| $6,200                   |
| of $10,000               |
| [#####][###]-----------  |
| o You $3,720 (60%)       |
| o Partner $2,480 (40%)   |
| ------------------------ |
| Remaining    Paid out    |
| $3,800       $4,100      |
| Monthly share            |
| $292/mo                  |
+--------------------------+
Budget items (4) [+ Add item]
[ breakdown bar + labels ]
+--------------------------+
| Flights     $1,800/$2,200|
| [=======-------]         |
| $400 left - Quote ...    |
| v 2 payments [Record pay]|
+--------------------------+
Progress over time
+--------------------------+
|  chart (220px)           |
+--------------------------+
Recent activity
+--------------------------+
```

At 375px the header actions wrap onto their own row under the meta row
(`flex flex-wrap gap-2`), so the title always has the full width.

### States

- **No contributions and no items**: Saved `$0` of target, empty track, legend
  hidden, percent `0%`, Paid out hidden, items empty block with Add item, chart
  placeholder "Add to the goal to start the chart", activity empty line.
- **No items**: no breakdown bar and no Paid out fact; the items section shows
  only the dashed empty block.
- **Fully funded**: chip "Funded" with `Check`, Remaining `$0` in `text-gain`
  with hint "Target reached", bar full, deadline text without time-left. The
  card's one-shot celebration animation is not added.
- **Overdue target date (not funded)**: chip "Behind", deadline text
  "Overdue by N days" in `text-loss-strong`, Monthly share shows "Past target
  date" at `text-sm`.
- **Masked amounts**: name, every amount, percent, legend, item amounts, quote
  text, breakdown labels and activity amounts go through `mask`. Bars render
  their tracks only. The chart is not mounted (so no axis or tooltip can leak)
  and the placeholder keeps its height. Status chip hidden (as on the card).
  Add to goal, Edit, the menu trigger, Add item, Record payment and the
  per-row icons are disabled as today. Deadline text (a date, not an amount)
  stays visible.
- **Locked, no household, not found, load error**: unchanged `Notice` and lock
  views.
- **Loading skeleton** (`goal-detail-skeleton.tsx`) mirrors the new layout:
  back link (`h-11 w-24`), title (`h-8 w-56`) and meta (`h-5 w-64`), summary
  card (`h-56 w-full rounded-xl`), then at `lg` a two-column grid with a tall
  items block (`h-72 rounded-xl`) and, in the right column, `h-[220px]` chart
  and `h-40` activity blocks; below `lg` they stack in the same order.

### New pure helper

`goalDeadline(goal, now)` in `lib/goal-stats.ts`:

- Input: `Pick<HouseholdGoal, 'targetDate' | 'remaining' | 'targetAmount' |
'contributed'>` and a `Date`. Funded is decided the same way as `goalStatus`.
- Output: `{ kind: 'none' } | { kind: 'funded'; date: string } | { kind:
'overdue'; date: string; days: number } | { kind: 'upcoming'; date: string;
days: number }`, with `days` in whole calendar days (`startOfDay` on both
  sides, like `goalStatus`).
- Copy is built in the component: upcoming up to 60 days "N days left" (1:
  "1 day left", 0: "Due today"), beyond that "about N months left"
  (`Math.round(days / 30)`); overdue "Overdue by N day(s)".

## Files to change

- `src/features/household/components/goal-detail.tsx`: header (chip, deadline,
  actions menu, Add to goal), new section order and desktop grid; removal of the
  four `StatCard`s and the share line; state wiring for Add to goal.
- `src/features/household/components/goal-summary.tsx` (new): summary Card,
  split bar, legend, facts, over-commit note.
- `src/features/household/components/goal-status-chip.tsx` (new): the chip with
  the card's classes; `goal-card.tsx` is not changed (open question 5).
- `src/features/household/components/goal-activity.tsx` (new): activity list.
- `src/features/household/components/goal-item-list.tsx`: single-lane row, text
  meta, outline `Record payment`, collapsible payments, divided list container,
  empty block (the empty block may live in `goal-detail.tsx`).
- `src/features/household/components/goal-burn-up-chart-content.tsx`: legend,
  hidden and no-data placeholders at 220px.
- `src/features/household/components/goal-detail-skeleton.tsx`: new layout.
- `src/features/household/lib/goal-stats.ts`: `goalDeadline`.
- `src/features/household/constants.ts`: only if a shared string or the
  `DEADLINE_SOON_DAYS = 60` constant is wanted; otherwise untouched.
- `src/features/household/components/item-breakdown-bar.tsx`: optional prop
  `showOverNote` (default `true`, so the card and other callers are unchanged).
- Barrel `src/features/household/index.ts`: untouched unless a new component
  must be consumed outside the feature (none expected).
- Not edited: `src/app/dashboard/household/goals/[goalId]/page.tsx`,
  `loading.tsx` (thin composers), `goal-card.tsx`, `goal-editor-sheet.tsx`,
  `add-contribution-dialog.tsx`.

### Tests

- `test/features/household/goal-stats.test.ts`: `goalDeadline` for none,
  funded, due today, 1 day, 45 days, 400 days, overdue 1 and 15 days, and a
  corrupt target not reading as funded.
- `test/features/household/goal-detail.test.tsx`: update the existing cases
  that look for the four stat labels and the "You 60% / Partner 40%" line; add
  cases for: the primary Saved value; split legend text; status chip and
  deadline text (on track, funded, overdue); Delete reachable only through the
  Goal actions menu and still confirming then routing; Add to goal opens the
  contribution dialog in add mode; empty goal copy; section order by heading
  order in the DOM; hidden state shows no chip, no percent, no amounts, the
  chart placeholder text and disabled actions.
- `test/features/household/goal-item-list.test.tsx`: payments collapsed by
  default and toggled with `aria-expanded`; over-budget text; quote text;
  `Record payment` is a button that opens the same form; amounts masked.
- A skeleton assertion that the loading view contains the items and chart
  blocks (shape, not pixel values).

## Out of scope

- No server action, schema, migration, RLS or crypto change; no new dependency.
- No change to goal maths (`goalStatus`, `goalPlanShare`, `burnUpSeries`,
  `breakdownSegments`), the plan engine, or what the numbers mean.
- No change to `goal-card.tsx`, `goal-list.tsx`, `goal-editor-sheet.tsx` or the overview page; `item-breakdown-bar.tsx` gains
  only the optional `showOverNote` prop.
- No re-theme: no new colors, fonts or tokens; no PRODUCT.md or DESIGN.md.
- No new features beyond Add to goal (open question 1); no payment/contribution
  data-model changes, no filtering or export.
- No real-device verification in this spec (see Acceptance).

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint` (max-warnings=0), `pnpm typecheck`,
      `pnpm test:ci`, `pnpm build` green
- [ ] No `any`, `console.log`, `@ts-ignore` or `eslint-disable`; no
      "Spec NNN" or narration comments
- [ ] Tests listed above added or updated and passing; new helper covered
- [ ] Existing behavior intact: pay item, delete item and payment with undo,
      add item (including the 50 item limit reason), split and goal edit via
      the editor Sheet, edit contribution and payment from activity, delete
      goal with confirm and route back, masking and the `canReveal()` guard
- [ ] Manual, light and dark: one clear primary number (Saved); status chip and
      deadline visible; items list readable; chart axis and tooltip legible
- [ ] Manual at 375px: no horizontal scroll; title never squeezed by actions;
      every control at least 44px on coarse pointers
- [ ] Manual with "Hide amounts" on: nothing numeric visible anywhere on the
      page (including chart area and tooltips), layout height stays stable
- [ ] Manual states: empty goal, no items, funded, overdue, over-committed
- [ ] Skeleton matches the loaded structure (no visible jump when data lands)
- [ ] Optional: run `impeccable detect --json` over the changed components and
      resolve findings that are not intentional
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: one page and its feature components; no data or API change.
  Risk is a masking leak in a new surface (percent, legend, bar fill, chart
  placeholder) and a lost tap target; both have explicit tests and checks above.
- **Reversibility**: single git revert; no migration.
- **Backout plan**: revert the implementation commit; the spec stays as a record.

## Open questions

- [x] Q1 (resolved 2026-11-15: yes): The page has no way to add a contribution (only the card does). Add an
      "Add to goal" button reusing the existing `AddContributionDialog`? — Owner:
      Clarence — Recommended: yes (no new action, one component reused; the page
      about a goal should let you add to it).
- [x] Q2 (resolved 2026-11-15: yes, "Monthly share" with hint "of your plan"): Keep the label "Share of monthly plan", or rename to "Monthly share"
      / "Set aside per month"? The value's meaning (the goal's slice of the plan)
      is unchanged. — Owner: Clarence — Recommended: "Monthly share" with the
      hint "of your plan".
- [x] Q3 (resolved 2026-11-15: yes): Collapse payments under each item by default (they also appear in
      Recent activity)? — Owner: Clarence — Recommended: collapsed by default,
      count shown.
- [x] Q4 (resolved 2026-11-15: yes): Merge the three per-item lanes (estimate, quote, paid) into one paid
      lane with estimate and quote as text? — Owner: Clarence — Recommended: yes;
      the lanes are 4px high and have no legend.
- [x] Q5 (resolved 2026-11-15: no, card unchanged): Should `goal-card.tsx` adopt the new `GoalStatusChip` so the chip lives
      in one place? — Owner: Clarence — Recommended: no for this spec (keeps the
      card out of the diff); follow up separately.
- [x] Q6 (resolved 2026-11-15: yes, two columns at lg): Desktop layout puts Budget items left and chart plus activity right at
      `lg`. Prefer a single column at every width instead? — Owner: Clarence —
      Recommended: the two-column layout; fall back to one column only if the
      right column feels cramped at 1024px.
