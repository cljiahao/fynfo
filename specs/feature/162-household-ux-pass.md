---
id: '162'
slug: household-ux-pass
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-10-30
approved: 2026-10-30
shipped: 2026-10-31
impl_pr: direct to main, 44abdb2 (impl/162-household-ux-pass)
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§2.2'
  - '§2.3'
  - '§2.6'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§4.1'
  - '§5.2'
  - '§5.4'
constitution_overrides:
---

# Spec 162: Household page UX pass

## Problem

An impeccable critique of `/dashboard/household` found problems in four groups.
The owner said "fix all issues". Every claim below was re-checked against the
code at `d0bb026`; claims that were wrong or stale are listed under
"Corrections to the critique".

1. **Destructive actions are one click with no confirm or undo.** Deleting a
   goal (`goal-list.tsx:23-29`, cascades to every contribution and budget item),
   a shared-spending entry (`shared-spending.tsx:283-296`), a trip
   (`shared-spending.tsx:397-411`, cascades to its entries), a budget item
   (`project-breakdown.tsx:177-192`, cascades to its payments) or a payment
   (`project-breakdown.tsx:285-299`) fires the server action immediately. The
   goal and trip buttons sit next to Edit / Add with no visual weight difference.
2. **Accessibility gaps.**
   - Delete labels repeat: `Delete ${entry.date} spending`
     (`shared-spending.tsx:287`) and `Delete payment on ${payment.date}`
     (`project-breakdown.tsx:289`) are identical for two rows on the same day.
   - The Goals / Spending switch is `role="group"` plus `aria-pressed`
     (`household-overview.tsx:97-113`), not tabs: no tablist, no arrow keys, no
     tabpanel.
   - Hit targets under 44px: goal-card Edit and Delete are `Button size="sm"`
     (`goal-card.tsx:121-143`, `h-8` ≈ 32px high, ≈ 36px wide); the entry delete is
     a bare 14px icon (`shared-spending.tsx:283-296`, `size-3.5`); the payment
     delete is a 12px icon (`project-breakdown.tsx:285-299`, `size-3`); the
     Breakdown toggle is a text-sm line with no padding
     (`project-breakdown.tsx:61-75`, ≈ 20px high); the dialog close button is the
     16px `XIcon` with no padding (`src/components/ui/dialog.tsx:69-76`).
   - Validation is toast-only: `create-goal-dialog.tsx:55-58`,
     `add-contribution-dialog.tsx:47-50`, `shared-spending.tsx:129-132`,
     `shared-spending.tsx:314-321`, `project-breakdown.tsx:36-39,148-151`. No
     `aria-invalid`, nothing tied to the field.
   - Heading levels: `h1` (`page-header.tsx:13`), then goal title `h3`
     (`goal-card.tsx:51`), spending sections `h3` (`shared-spending.tsx:72,93`),
     trip `h4` (`shared-spending.tsx:394`). No `h2` anywhere.
   - Controls with a placeholder or `aria-label` only: the quick-add date
     (`shared-spending.tsx:234-241`), the spending month filter (`:73-81`), the
     trip name and both trip dates (`:345-368`), the new-item name and budget
     (`project-breakdown.tsx:94-116`). Sighted users lose the field's meaning
     once it holds a value.
3. **Information architecture and identity.**
   - The invite panel shows for every owner on the Goals tab forever
     (`household-overview.tsx:164`), even after the partner joined.
   - The header action "New goal" exists only on the Goals tab
     (`household-overview.tsx:80-93`), so the header changes height and content
     when switching tabs.
   - "You" is `primary` and "Partner" is `gain` (`goal-card.tsx:75-76,98,102`,
     `spending-summary.tsx:30,34`). `gain` is the profit green used app-wide
     (`globals.css:126`), and `primary` is neutral black / white
     (`globals.css:105,176`), not the brand sky, so neither colour says "person".
4. **Layout and polish.** A lone goal fills half the row
   (`goal-list.tsx:45`, `sm:grid-cols-2`). `Card` has `py-6` and the content
   adds `p-5`, so every goal and trip card has a 44px top inset against 20px
   sides (`card.tsx:10`, `goal-card.tsx:48`, `shared-spending.tsx:391`). Hiding
   amounts removes the progress bar (`goal-card.tsx:71`), so the card shrinks
   and the grid jumps. The edit dialog prefills the target as `String(4000)`
   (`create-goal-dialog.tsx:37-39`). The empty goals state has copy but no
   action (`goal-list.tsx:31-41`). The breakdown summary packs count, paid and
   budgeted into one line (`project-breakdown.tsx:52-57`). The "owes" sentence
   (`spending-summary.tsx:39-45`) never says why the split is even.

## Constitution check

- Satisfies: `§1.1` (household-scoped UI only), `§2.2` (no new mutation
  surface; existing server actions are reused, deferral is client-side), `§2.3`
  (the one action touched, `getHousehold`, already calls `requireDbContext()`),
  `§2.6` / `§2.7` (barrel and named exports kept), `§3.1` (no new package:
  `radix-ui@1.4.3` and `sonner@2.0.7` are already in `package.json`; the new
  shadcn primitives are generated from `radix-ui`), `§3.2` (Tailwind classes
  only, no inline styles), `§4.1` (all gates), `§5.2` (the member count reads
  `household_members` under the existing `"Members read roster"` policy,
  `supabase/migrations/20260626000000_add_household.sql:113-115`), `§5.4`
  (the count filters on plaintext `household_id` only; no encrypted column is
  queried).
- Overrides: none. Touching `src/components/ui/dialog.tsx` is not a
  constitution issue but it is an app-wide primitive; see Open questions.

## Corrections to the critique

Verified against code; the brief's original wording is replaced where noted.

- **Partner colour `--chart-2` is wrong.** `--chart-2` is `oklch(0.6 0.14 158)`
  light and `oklch(0.76 0.15 158)` dark (`globals.css:138,209`): the same hue
  158 as `--gain`. Mapping partner to it would not fix the clash. The
  non-green members of the ramp are `--chart-3` (amber, hue 75), `--chart-4`
  (purple, 300) and `--chart-5` (red, 27, too close to `--loss`).
  `--chart-1` equals `--brand` (hue 240). See Solution shape for the chosen
  mapping.
- **"You = primary" is neutral, not brand.** `--primary` is
  `--color-neutral-900` (`globals.css:105`). Mapping "You" to `--brand` is a
  change, not a no-op.
- **QuickAdd has no payer or split controls.** The brief assumed
  "date / payer / split". The form has five controls: For (space select), Category,
  Note, Amount and Date (`shared-spending.tsx:161-246`). The payer is always the
  caller (`isSelf`) and the split is always even
  (`lib/shared-spending.ts` `summarizeSpending`). Regrouping is over those five.
- **The Funded state already exists.** `goal-card.tsx:47,58-63,90` shows a "Funded"
  pill, `border-gain/50` and "Goal reached". The gap is that it is static, not
  that it is missing. The "moment" is a one-time entrance on the transition.
- **Amounts-hidden state already hides the bar**, it does not keep it
  (`goal-card.tsx:71`, `project-breakdown.tsx:195`). The percentage text is
  also masked (`mask(`${goal.pct}%`)`, `goal-card.tsx:65`). So the app already
  treats percentage as sensitive; see the bar decision below.
- **Invite hiding needs data the client does not have.** `HouseholdSummary`
  (`types.ts:4-11`) has no member count, and goal contributions cannot prove a
  partner exists. A plaintext count must be added to `getHousehold`.
- **The "blank gap at top of card" is not mobile-only.** It is `Card py-6` plus
  `CardContent p-5` at every width. Not re-rendered in a browser for this spec;
  confirm visually during implementation.
- **Line numbers in the brief were stale** (spec 161 shifted `goal-card.tsx` by
  one control). The numbers in this spec are current.
- **Dark-mode "pill too bright" is unverified.** The active view uses
  `Button variant="secondary"` (`button.tsx:18-19`). It goes away when the
  switch becomes Tabs, so no separate fix is specified; the tabs styling is
  checked in dark mode during implementation.
- **Entry delete is worse than reported**: a raw `<button>` with a `size-3.5`
  icon and no padding, not a `Button`. The item delete is already unique by
  name (`project-breakdown.tsx:183`), so only entry and payment labels repeat.

## Solution shape

All changes are in `src/features/household/` unless a path says otherwise. No
migration, no new column, no RLS change, no encryption-touching change.

### 1. Destructive actions

- **Decision: keep delete; no archive, no migration.**
- **Confirm dialog for goal and trip delete** (high blast radius, cascade).
  Neither `alert-dialog` nor `tabs` exists in `src/components/ui/`. Add
  `src/components/ui/alert-dialog.tsx` and `tabs.tsx` with
  `npx shadcn@latest add alert-dialog tabs` (new-york style per
  `components.json`). Both wrap `radix-ui`, already installed; the CLI must not
  add a package, and the implementer must check `package.json` is unchanged.
- New `src/features/household/components/confirm-delete-dialog.tsx`:
  `ConfirmDeleteDialog({ open, onOpenChange, title, description, confirmLabel,
onConfirm, pending })`. The confirm button uses `variant="destructive"`.
  Cancel is the default focus. The description names what is lost ("This also
  deletes 3 contributions and 2 budget items") using counts, which are not
  amounts and are safe to show; the goal name goes through `mask()`.
  - Goal: opened from `GoalList`; `deleteGoal.mutate` runs only on confirm.
  - Trip: opened from `TripCard`; text states the entry count.
- **Undo toast for entry, item and payment delete** (lower blast radius).
  Decision: **delay-then-commit, not re-insert.** Items and payments are
  insert/delete-only by design (`REVOKE UPDATE` in
  `supabase/migrations/20261023000149_household_project_items.sql:95-96`), and
  a re-insert would mint a new id, change `created_at` and, for payments,
  re-run encryption of the amount. Deferring leaves the row untouched until the
  user can no longer undo.
- New provider and hook `src/features/household/hooks/use-undoable-delete.tsx`:
  `UndoableDeleteProvider` plus `useUndoableDelete()` returning
  `{ pendingIds: ReadonlySet<string>, request({ id, label, commit, errorMessage }): void }`,
  where `commit(): Promise<void>` is the existing mutation called as
  `mutateAsync` (so the result survives the caller unmounting).
  - **Lifted above the tabs.** Radix `TabsContent` unmounts its panel on a tab
    switch, and `ProjectBreakdown` / `EntryList` live inside those panels. A
    hook owned by those components would unmount mid-window, flush the delete
    early and leave a dead Undo toast. So the provider is mounted once in
    `HouseholdOverview` (outside `Tabs`), owns all timers, and the 6s window
    survives tab switches. Consumers only call `request` and filter their
    rows with `pendingIds`.
  - Timers live in a `Map<id, timeout>`. `request` is a no-op while `id` is in
    the map (guards double-click and double-fire). Undo and the timeout both
    delete the map entry first, so a commit cannot run twice.
  - `request` shows `toast(label, { id: toastId, duration: delayMs, action: { label: 'Undo', onClick } })`
    and starts `setTimeout(delayMs)` (`delayMs = 6000`). Undo clears the timer
    and the map entry and removes the id from `pendingIds`; nothing is sent.
  - On timeout it calls `commit()`. The id stays in `pendingIds` until the
    commit has resolved and the goals / spaces query has refetched (the
    existing mutation `onSuccess` returns `refreshQueriesAfterMutation`; the
    implementer verifies it is awaited, otherwise the provider awaits the
    refetch), so the row cannot flash back. On error the id leaves
    `pendingIds` (row reappears) and `errorMessage` is toasted.
  - The timer, not Sonner's `onAutoClose`, is authoritative, so a
    swipe-dismissed toast does not commit early and tests can use fake timers.
  - **Flush only when the provider itself unmounts** (leaving the page): each
    pending timer is cleared, its `commit()` is called, and
    `toast.dismiss(toastId)` removes the now-useless Undo toast. Closing the
    browser tab inside the window loses the delete and the row reappears;
    accepted (Open question 4).
  - **Toast label uses non-amount fields only** (category, item name, "Payment",
    "Entry"), each through `mask()`; it never contains a figure. With amounts
    hidden the delete buttons are disabled, so a masked delete is not
    reachable.
- Delete buttons: `variant="ghost"` with `text-muted-foreground
hover:text-destructive` stays for the resting state (icon-only buttons stay
  quiet), and the confirm button in the dialog is the `destructive` variant.
- **Delete aria-labels become unique** and leak nothing masked:
  - entry: `Delete ${mask(entry.category)} ${mask(formatSGD(entry.amount))} on
${format(date, 'dd MMM')}` (note appended through `mask()` when present);
  - payment: `Delete ${mask(formatSGD(payment.amount))} payment on
${format(date, 'dd MMM yyyy')} by ${You|Partner}`.
    `mask()` returns the masked string when amounts are hidden, so the label
    never contains a real figure in that state. Two rows with identical
    category, amount and day remain indistinguishable, but they are also
    indistinguishable on screen.

### 2. Accessibility

- **Tabs.** Replace the `role="group"` switch in `household-overview.tsx` with
  shadcn `Tabs` (`Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`), controlled
  by the existing `view` state. Radix supplies `role=tablist|tab|tabpanel`,
  `aria-selected`, `aria-controls` and Left/Right/Home/End. Inactive panels
  unmount (Radix default), matching today's conditional rendering, so
  `useSpaces(... view === 'spending')` keeps its lazy fetch. Tabs stay hidden
  while `locked`.
- **Hit targets.** Minimum 44px on touch, current size kept on fine pointers,
  using Tailwind v4's `pointer-coarse:` variant (no new CSS):
  - goal-card Edit / Delete and the item delete: `pointer-coarse:size-11`;
  - entry and payment delete: replace the bare `<button>` with
    `Button size="icon-xs"` plus an `after:absolute after:-inset-2.5` hit area
    on `pointer-coarse:` so the row height does not grow;
  - Breakdown toggle: `min-h-11` (full-width row, so width is fine);
  - dialog close: see Open question 3. Recommended: in
    `src/components/ui/dialog.tsx:69-76` add an invisible expanded hit area
    (`after:absolute after:-inset-3`), no visual change. This is an app-wide
    primitive, so run the full suite and eyeball one other dialog. Household-only
    fallback: `showCloseButton={false}` plus a local close, which duplicates the
    primitive and is not recommended.
- **Inline validation.** Use the existing `Field` / `FieldError` from
  `src/components/ui/field.tsx` (already present). Replace the validation
  toasts in `create-goal-dialog`, `add-contribution-dialog`, `QuickAdd`,
  `NewTripForm`, the new-item form and the payment form with per-field errors:
  `aria-invalid` on the input, `aria-describedby` pointing at the error
  element, error element `role="alert"` only on submit (not on every keystroke),
  focus moves to the first invalid field. Server failures ("Could not ...") stay
  toasts. Messages: "Enter a name", "Enter an amount above 0", "Pick a date".
  Errors clear on the next change to that field.
- **Heading hierarchy.** Page `h1` (PageHeader). Under the active tab: goal card
  titles and spending section titles ("Household spending", "Trips") become `h2`;
  trip titles become `h3`. Rendered with `<h2>`/`<h3>` plus the same classes;
  no visual change.
- **Visible labels** on the controls that rely on placeholder / `aria-label`
  alone: quick-add date (label "Date"), spending month (label "Month"), trip
  name / start / end (labels "Trip name", "From", "To"), new-item name / budget
  ("Item", "Budget"). Payment amount and date inside an item keep their
  descriptive `aria-label` (they are inline, one-off controls under a labelled
  item) and gain short visible labels only if the layout fits at 320px.

### 3. Information architecture

- **Invite panel only while no partner.** `getHousehold()`
  (`actions/household-actions.ts:80-108`) also counts the roster:
  `household_members` rows where `household_id` equals the caller's, selected
  with `{ count: 'exact', head: true }`; the two-member cap trigger
  (`20260626000000_add_household.sql:70-88`) bounds it at 2; the UI compares against `HOUSEHOLD_MEMBER_CAP` (`constants.ts:5`), never a literal 2. `HouseholdSummary`
  gains `memberCount: number`. The overview renders `InvitePanel` only when
  `isOwner && memberCount < HOUSEHOLD_MEMBER_CAP`. After the partner joins nothing replaces it;
  the header stays clean. No encrypted data is read.
- **Stable header.** `PageHeader` action slot always holds a primary action of
  the same size: Goals tab "New goal"; Spending tab "Add spending", which
  scrolls to and focuses the quick-add Amount field (stable id from
  `constants.ts`). The slot gets a fixed `min-h-9` wrapper so the header height
  never changes, including while goals load or when the Spending tab has no space
  yet (button absent, height reserved).

### 4. Identity and the Funded moment

- **Colours.** You = `--brand` (hue 240, sky, same as `--chart-1`), Partner =
  `--chart-4` (purple, hue 300). Blue and purple are close for some colour-vision
  types, so identity never relies on colour alone: the legend text ("You",
  "Partner") stays, and the progress bar segments get a 1px `--card` divider
  (`stroke`/`gap`) if the two fills read too close in dark mode (check in
  implementation). Alternative `--chart-3` amber is the other candidate (blue vs
  amber is the safest CVD pair) but reads as the `warning` token; Open question 1.
  Classes: `fill-brand` / `bg-brand` and `fill-chart-4` / `bg-chart-4` (both
  tokens already map to Tailwind colours: `--color-brand`,
  `--color-chart-4` in `globals.css:50,69`). No new tokens.
- Single source: `src/features/household/constants.ts` (existing: already holds `INVITE_TTL_HOURS` and `HOUSEHOLD_MEMBER_CAP`) gains
  `PERSON_COLORS = { you: { fill: 'fill-brand', dot: 'bg-brand' }, partner: {
fill: 'fill-chart-4', dot: 'bg-chart-4' } }` and `QUICK_ADD_AMOUNT_ID`. Class
  strings are literal so Tailwind sees them. Used by `goal-card.tsx` and
  `spending-summary.tsx`.
- **Funded moment.** When `funded` flips from false to true while the card is
  mounted (contribution added, or target edited down), the Funded pill and the
  border play a one-shot entrance (CSS `@keyframes` scale/fade, defined with the
  pill). The repo uses `eslint-config-next` (`eslint.config.mjs:2-3`), whose
  React hooks rules (refs during render, set-state-in-effect) run under
  `--max-warnings=0`, so no ref is read or written in render and no effect sets
  state. Render-safe mechanism: a `useState` previous-value pair,
  `const [prevFunded, setPrevFunded] = useState(funded)` and
  `const [celebrate, setCelebrate] = useState(false)`; during render,
  `if (funded !== prevFunded) { setPrevFunded(funded); setCelebrate(funded); }`
  (React's documented derive-state-from-props pattern). The animation class is
  applied while `celebrate` is true and cleared by
  `onAnimationEnd={() => setCelebrate(false)}`. Initial render of an
  already-funded goal does not animate because `prevFunded` starts equal to
  `funded`. The implementer runs `pnpm lint` to confirm. Respects the existing
  global `prefers-reduced-motion` guard (`globals.css:259-268`, which flattens
  animation duration to 0.01ms, so `animationend` still fires and the class
  clears). No animation library. Funded colour stays `gain` because funded is
  a good outcome, which is the intended meaning of that token.

### 5. Layout and polish

- **Sole goal** spans the row: `GoalCard` accepts `className`; `GoalList` passes
  `sm:col-span-2` when `goals.length === 1`.
- **QuickAdd regroup** (five controls, none removed): primary row = Category,
  Amount, Add (the burst-entry path, with `amountRef` focus kept); secondary
  row (`sm:` one line, stacked on mobile) = For, Date, Note. Tab order follows
  reading order: For, Date first would slow bursts, so the DOM order is
  Category, Amount, Add, then For, Date, Note, matching visual order. "Add" stays
  a submit button; Enter in any field submits.
- **Card top inset**: the Card gets `py-0` (the `CardContent` `p-5` already
  provides padding) on goal and trip cards.
- **Masked state keeps card height.** Decision: **keep the track, drop the
  fills.** The percentage is already masked (`goal-card.tsx:65`), so the fill
  proportion would leak exactly that value; a fill drawn while hidden is
  rejected. `goal-card.tsx:71` and `project-breakdown.tsx:195` render the
  `bg-muted h-2.5` / `h-1.5` track always and the `ProgressBar` only when not
  hidden. Card height is then identical in both states.
- **Edit prefill**: `goal ? goal.targetAmount.toFixed(2) : ''`. A
  `type="number"` input cannot show thousands separators (a comma is invalid
  input), so the fix is a fixed two-decimal string ("4000.00"), not "4,000".
- **Empty goals state** gets an inline "New goal" button. `GoalList` already
  renders a dialog; it owns a local `createOpen` for this CTA, so the page-level
  button and the empty-state button both open the same dialog via a shared
  `onCreate` prop from the overview (no duplicate dialog instance).
- **Breakdown summary**: split into a primary line (`3 items`) and a secondary
  muted line (`S$... paid of S$...` through `mask()`), two lines in the toggle.
- **Helper copy for the partner first-timer** in `SpendingSummary`: one muted
  line under the settle sentence, "Everything shared is split 50/50. Whoever
  paid more is owed the difference." Shown always (it is one line); no
  per-user dismiss state.
- **Currency "S$" vs "$"**: `formatSGD` (`src/lib/utils/currency.ts:21`) uses
  `Intl.NumberFormat('en-SG', { currency: 'SGD' })`, which prints "$". It is
  used in 30 non-test files outside `currency.ts` (`formatSGD` or
  `formatSGDWhole`; 37 counting `formatCurrency`). **Not changed in this spec**; household-only "S$"
  would make household and personal pages disagree. See Open question 2.

### Files and ownership

New: `src/components/ui/alert-dialog.tsx`, `src/components/ui/tabs.tsx` (CLI),
`src/features/household/components/confirm-delete-dialog.tsx`,
`src/features/household/hooks/use-undoable-delete.tsx`.
Edited: `src/features/household/constants.ts`, `goal-card.tsx`, `goal-list.tsx`, `create-goal-dialog.tsx`,
`add-contribution-dialog.tsx`, `shared-spending.tsx`, `project-breakdown.tsx`,
`spending-summary.tsx`, `household-overview.tsx`, `types.ts`,
`actions/household-actions.ts`, and (if Open question 3 is approved)
`src/components/ui/dialog.tsx`.

## Implementation plan

Four slices with disjoint file sets. Slice 0 lands first (its outputs are
imported by the others); slices A, B, C then run in parallel. Each slice
includes its own tests.

- **Slice 0: foundation.** Owns: `src/components/ui/alert-dialog.tsx`,
  `src/components/ui/tabs.tsx` (shadcn CLI, confirm `package.json` unchanged),
  `src/components/ui/dialog.tsx` (only if approved),
  `constants.ts` (edit: add `PERSON_COLORS`, `QUICK_ADD_AMOUNT_ID`),
  `components/confirm-delete-dialog.tsx`,
  `hooks/use-undoable-delete.tsx`, and their tests
  (`test/features/household/confirm-delete-dialog.test.tsx`,
  `use-undoable-delete.test.tsx`).
- **Slice A: goals.** Owns: `goal-card.tsx`, `goal-list.tsx`,
  `create-goal-dialog.tsx`, `add-contribution-dialog.tsx`, and
  `goal-card.test.tsx`, `goal-edit.test.tsx`. Covers: confirm on goal delete, colours, Funded moment, sole
  span, masked track, 44px targets, h2, inline errors in both dialogs, edit
  prefill, empty-state CTA, `className` and `onCreate` props.
- **Slice B: spending and breakdown.** Owns: `shared-spending.tsx`,
  `project-breakdown.tsx`, `spending-summary.tsx`, and
  `shared-spending-view.test.tsx`, `project-breakdown.test.tsx`. Covers: undo
  toast for entry / item / payment, confirm on trip delete, unique labels,
  visible labels, inline errors, QuickAdd regroup (uses `QUICK_ADD_AMOUNT_ID`),
  summary split, helper copy, colours via `PERSON_COLORS`, masked item track,
  h2 / h3, 44px targets.
- **Slice C: overview and household data.** Owns: `household-overview.tsx`,
  `types.ts`, `actions/household-actions.ts`, and
  `household-overview.test.tsx`, `household-actions.test.ts`, and the whole of
  `household-workflows.test.tsx` (Slices A and B do not touch it; C updates its
  goal and spending flows for the new markup). Covers: mounting
  `UndoableDeleteProvider` above `Tabs`, Tabs,
  stable header action and focus-to-amount, invite shown only while
  `memberCount < HOUSEHOLD_MEMBER_CAP`, `memberCount` in `getHousehold`.

Cross-slice contracts fixed up front by Slice 0 so A, B, C do not edit each
other's files: `PERSON_COLORS`, `QUICK_ADD_AMOUNT_ID`, `ConfirmDeleteDialog`
props, and `UndoableDeleteProvider` / `useUndoableDelete` signature (all in the Solution shape above).
`GoalList` gets `onCreate` from the overview (Slice C passes it, Slice A
declares it as an optional prop so either can merge first).

No new dependencies. No `any`, no `console.log`, no lint suppressions.
Comments explain why only.

## Tests

jsdom per-file opt-in (`// @vitest-environment jsdom`, Testing Library), as in
`goal-card.test.tsx`. Fake timers for the undo window.

- Confirm dialog gates delete: clicking Delete on a goal or trip opens the
  dialog and does not call the mutation; Cancel closes without calling it;
  Confirm calls it once; the confirm button is the destructive variant.
- Undo window survives a tab switch: request an entry delete on Spending,
  switch to Goals and back inside 6s; the mutation has not been called, the
  Undo toast is still live and still works; after 6s it is called once. Leaving
  the page (provider unmount) calls the commit once and `toast.dismiss` for the
  toast. A second `request` for a pending id does nothing; Undo then timeout
  never commits.
- Undo cancels a deferred delete: entry / item / payment click hides the row
  and shows an "Undo" toast action; clicking Undo restores the row and the
  mutation is never called; letting `delayMs` elapse calls it once; a mutation
  error restores the row; provider unmount inside the window flushes the commit.
- Tablist: `role=tablist` with two `role=tab`; `aria-selected` follows the
  selection; ArrowRight / ArrowLeft / Home / End move and select; the active
  `role=tabpanel` is labelled by its tab; the Spending query stays disabled
  until that tab is selected; locked household shows no tabs.
- Inline errors: submitting empty create-goal, add-contribution, QuickAdd,
  trip, item and payment forms sets `aria-invalid="true"` on the offending
  input, renders an error whose id is in the input's `aria-describedby`, moves
  focus to the first invalid field, and shows no validation toast; editing the
  field clears the error.
- Invite hidden once partner exists: owner with `memberCount: 1` sees
  `InvitePanel`; owner with `memberCount: 2` does not; member never does.
- `getHousehold` returns `memberCount` from a fake roster of 1 and 2 rows.
- Masked state keeps the bar: with amounts hidden the progress track element
  is present, no fill `rect` is rendered, no figure or `%` text appears, and
  the track class (height) equals the visible state's.
- Sole-goal span: one goal renders with `sm:col-span-2`; two goals render
  without it.
- Unique delete labels: two entries and two payments on the same date yield
  distinct `aria-label`s; with amounts hidden the labels contain no digit
  from the amount.
- Heading levels: the rendered Goals tab has one `h1` and the goal titles are
  `h2`; the Spending tab has `h2` sections and `h3` trips.
- Funded moment: the animation class is absent on first render of an
  already-funded goal and present after a rerender that crosses the target.
- Edit dialog prefills "4000.00" for a 4000 target.
- Empty goals state shows a "New goal" button that opens the dialog.
- Existing household tests are updated for the changed markup, not deleted.

## Out of scope

- Contribution history, editing or deleting contributions.
- Editing entries, budget items, payments or trips (items and payments stay
  insert/delete-only by design).
- Archive or soft delete, trash view, any migration, RLS change or new column.
- Re-theme: OKLCH tokens, `StatCard` and `PageHeader` stay; no new tokens.
- App-wide currency symbol change (see Open question 2).
- Personal (non-household) pages.
- A persistent "partner joined" notice or header link after the invite panel
  goes away.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new tests cover every item under Tests
- [ ] `pnpm build` green
- [ ] `package.json` and the lockfile are unchanged
- [ ] Manual (owner): delete a goal and a trip asks first; delete an entry,
      item and payment shows Undo and Undo restores it; the delete really happens
      after about six seconds
- [ ] Manual: keyboard only, Left / Right switches Goals and Spending; screen
      reader announces tab and panel; every delete button reads uniquely
- [ ] Manual: at 375px every tap target listed above is at least 44px
- [ ] Manual: submit empty forms and see inline errors, not toasts
- [ ] Manual: after the partner has joined, the owner no longer sees the invite
      panel; before, they do
- [ ] Manual: header height identical on both tabs; you vs partner are not
      green; funding a goal plays the Funded moment once; reduced-motion shows
      no animation
- [ ] Manual: hide amounts; card heights do not change and no proportion is
      drawn
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: `/dashboard/household` UI only, plus one read-only count in
  `getHousehold`. If `dialog.tsx` is edited (Open question 3) every dialog in
  the app is affected, but the change adds an invisible hit area only.
- **Deferred delete**: for six seconds the row is hidden but still exists. If
  the user closes the tab in that window the delete is dropped and the row
  returns. That is the safe failure. The partner's device still shows the row
  until the commit.
- **Reversibility**: code revert only; no migration. The two shadcn primitives
  can stay unused.
- **Backout plan**: revert the slice PRs in reverse order (C, B, A, 0). Slices
  are independent after slice 0, so a bad slice can be reverted alone.

## Open questions

- [x] Q1: Partner colour. `--chart-4` purple (recommended; clearly not the
      profit green or warning amber) or `--chart-3` amber (best blue/amber colour-vision
      contrast, but reads as a warning)? The brief's `--chart-2` is the same
      green as `gain` and is not an option. — Owner: Clarence — A: `--chart-4` purple.
- [x] Q2: Currency shows "$" because `formatSGD` is `en-SG` and used in
      about 30 non-test files
      places. Leave as is (recommended; Fynfo is single-currency SGD), change
      app-wide to "S$", or household-only "S$" (creates inconsistency)? —
      Owner: Clarence — A: Keep "$".
- [x] Q3: Dialog close button is 16px in the shared
      `src/components/ui/dialog.tsx`. Approve an invisible hit-area expansion
      there (app-wide, no visual change, recommended), or leave it? — Owner:
      Clarence — A: Approved; invisible hit-area expansion in `dialog.tsx`.
- [x] Q4: Undo window 6 seconds, and a closed tab inside the window drops the
      delete. Acceptable, or commit immediately and offer re-add instead? —
      Owner: Clarence — A: 6 s window is acceptable; a closed tab inside it drops the delete.
- [x] Q5: Spending-tab header action "Add spending" (focus the amount field).
      Prefer "New trip" or no action (reserve the space only)? — Owner:
      Clarence — A: "Add spending".
- [x] Q6: Confirm only goal and trip deletes (cascading, large) and use Undo for
      entry / item / payment. Item delete also removes its payments; keep it on
      Undo or move it to Confirm? — Owner: Clarence — A: Keep item delete on Undo.
