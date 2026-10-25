---
id: '154'
slug: statement-import-flow-redesign
area: feature
status: shipped
author: Claude Code
created: 2026-10-25
approved: 2026-10-25
shipped: 2026-10-25
impl_pr: direct commit to main (no PR)
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.4'
  - '§2.5'
  - '§2.6'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.3'
constitution_overrides: []
---

# Spec 154: Statement import flow redesign

## Problem

The owner imported a real statement with 45 transactions. All 45 ended
"Confirmed saved", but the flow was hard to follow:

1. **How to save was unclear.** Code review shows why:
   - Saving takes three steps, and the UI names none of them. Select rows
     (nothing is selected by default; "Select all expenses" sits in the
     toolbar). Then "Check possible duplicates". Then, if there are matches,
     tick an acknowledgement checkbox. Only then does "Save selected expenses"
     turn on. A disabled button never says why it is disabled.
   - The save section sits in its own `max-h-[28dvh]` scroll area under the
     two panes (`statement-review.tsx:697`). The checkbox comes after the
     "What gets saved" disclosure, often below the fold of that inner scroll.
   - Any edit, and any merchant-rule pass (`statement-review.tsx:84-93`),
     calls `invalidateReview()`. That silently clears the whole duplicate
     check, and Save turns off again with no message.
   - "Check" and "Save" are both full-size buttons. Their `default`/`outline`
     variants swap only after a successful check, so neither reads as the one
     next action.
   - After a successful save the modal stays open. It shows 45 lines like
     "Source page 2, line 37: Confirmed saved", each with its own disclosure,
     in the same 28dvh scroll area. Nothing says "done". Closing then shows
     the "Discard this review? Dispatched saves may still complete" confirm,
     because `allowDiscard()` treats any attempt as unsaved work
     (`use-statement-save.ts:401-407`).
2. **Duplicate warnings do not identify the row.** They read "Possible
   duplicate: source page N, line L" (`statement-save-review.tsx:81-89`). `L`
   is the index of the extracted PDF text line, counting headers
   (`statement-parser.ts:39`), and no row card shows it. Cards show only
   "Compare source · Page N"; the row number exists only in a screen-reader
   legend. The warning does not say what it matches (a saved expense or
   another row in the statement), and it is not a link. One checkbox covers
   every duplicate at once, so the user cannot resolve them one by one.
3. **Row pagination scrolls away.** "Previous rows / Next rows" sit at the top
   of the scrolling list (`statement-review.tsx:638`). After reading 20 cards
   the user must scroll back up to page. Paging also leaves the scroll
   position and focus where they were.
4. **No blocking feedback while working.** During the duplicate check and the
   save, only an inline `role="status"` line inside the 28dvh area changes.
   The rest of the modal looks usable, and the X and Esc still work (they
   open the discard confirm).
5. **The statement preview cannot be read.** The page renders into a canvas
   with `h-full w-full object-contain` (`statement-review.tsx:626-630`), so a
   whole A4 page shrinks into half the modal. Zoom and pan are not possible.
6. **The layout is cramped.** The source form (`details`, up to 35dvh), the
   "Saved merchant rules" button, the filter toolbar, the mobile view toggle,
   two panes and the save area all stack vertically in a 92dvh modal.
   Secondary actions take space from the rows.

## Constitution check

- Satisfies: `§2.1`/`§2.2` (no change to encryption or the existing save
  action; duplicate details stay in client memory), `§2.4` (the page still
  only composes the feature), `§2.5` (client components justified below),
  `§2.6`/`§2.7` (barrel, named exports), `§3.1` (pinned stack, no new
  dependency), `§3.2` HARD (no inline styles: zoom uses fixed Tailwind width
  classes, `<progress>` needs no style, canvas highlights paint in canvas
  pixels; static copy and zoom classes in `constants.ts`), `§3.4` (file
  naming), `§4.1`/`§4.3` (gates; the three existing eslint-disable lines keep
  their audit 152 citations, and no new suppression is planned).
- Overrides: none.
- `'use client'` stays on the import-review components. They need the local
  PDF worker, canvas, pointer events and in-memory selection, as in specs 133
  and 136.
- CSP (`src/lib/csp.ts`): no change. The viewer reuses the existing pdf.js
  session and blob worker. It adds no worker, eval, remote fetch or inline
  style.
- No new dependency. Pan and zoom use native scrolling and pointer events.
- No SQL, migration, RLS, crypto or protected-file change.

## Solution shape

### Flow: one primary action per step

A step indicator in the header shows **Choose → Review → Check → Save →
Done**. A footer action bar sits outside every scroll area and is always
visible. It holds a status line and exactly **one** primary button, whose
label follows the state:

| State                                | Status line (left)                                    | Primary button            |
| ------------------------------------ | ----------------------------------------------------- | ------------------------- |
| No selection                         | "Select the expenses to import"                       | "Select all N expenses"   |
| Selection, not checked or stale      | "12 selected · SGD 345.00 · not checked yet"          | "Check 12 for duplicates" |
| Unresolved duplicates                | "2 of 3 possible duplicates resolved"                 | "Go to next duplicate"    |
| A row marked "needs amend" or edited | "1 changed row needs a recheck"                       | "Recheck 1 row"           |
| Everything checked and resolved      | "12 ready · SGD 345.00 · 1 duplicate kept, 2 skipped" | "Save 12 expenses"        |
| Outcome needs attention              | "40 saved · 5 unconfirmed"                            | "Check saved expenses"    |

- "Clear selection" and the selection explainer become a quiet secondary
  link and an info icon in the action bar.
- The button is never disabled without a reason: the status line always
  states what is missing. Where a disabled state remains (privacy hidden,
  over `IMPORT_SAVE_LIMIT`), the reason sits next to it.
- An edit or rule pass never clears state silently. It marks only the rows
  it changed as "changed, recheck" (see Duplicates), and the status line says
  so.

### Header and layout

- `DialogContent` uses `showCloseButton={false}`. The header is one row:
  title and step indicator on the left; on the right, icon-plus-label ghost
  buttons **Change statement** and **Merchant rules**, an info popover
  ("Your PDF stays on this device", plus the "What gets saved" text), and a
  `DialogClose` X. On narrow screens the two text buttons collapse into an
  overflow `DropdownMenu`.
- **Change statement** returns to the Choose step. It uses the existing
  discard guard when a selection or unresolved attempts exist. The Choose
  step shows `StatementSourceForm` full width, without the `details`
  wrapper. The inline 35dvh form area goes away.
- **Merchant rules** opens the existing nested rules dialog. Row-level
  "Create rule" still works.
- Review body: two panes on `lg` (statement viewer | rows). Below `lg`, the
  existing Statement/Extracted toggle stays as a compact segmented control in
  the rows toolbar.
- Rows pane: a sticky toolbar at the top (filter select, which gains
  "Possible duplicates (n)" after a check, and the count) and a sticky pager
  at the bottom. Neither scrolls away.

### Pagination

- The pager ("‹ Rows 21–40 of 45 ›") is pinned with `sticky bottom-0` inside
  the rows pane, on `bg-background` with a top border.
- Paging scrolls the list to the top and moves focus to the first card of
  the new page, so keyboard users land in the right place. A live region
  announces the range.
- Each card shows a visible row number ("#14") and "Page 2 · line 37" next to
  "Compare source". The row number is the row's index in the full extracted
  list, so it stays the same across filters and pages.
- This also fixes a bug: today `number` uses the raw `rowPage` state, while
  slicing uses the clamped `currentRowPage` (`statement-review.tsx:679`).

### Duplicates: one by one

- `possibleImportDuplicates` returns match details, not just ids:
  `Map<inputId, DuplicateMatch>`, where
  `DuplicateMatch = { kind: 'saved'; date; item; amount } | { kind: 'statement'; rowId }`.
  The comparison rule from spec 136 is unchanged (calendar date, integer
  cents, folded description; shared records warn but are never written).
  Saved details come from the fresh `getExpenses()` read. They live in client
  memory and follow the existing privacy masking.
- The hook state changes from one `acknowledged` flag to per-row state:
  - `checkedSignature: Record<rowId, string>`: the input JSON at check time.
    A row is **stale** when its current input differs. Editing one row
    marks only that row stale.
  - `resolution: Record<rowId, 'keep' | 'skip' | 'amend'>` for rows with a
    match.
  - `reviewed` is true when every selected row is checked and not stale, and
    every matched row is resolved as `keep`.
- Each duplicate card shows a warning block at the top, before the fields:
  - "Possible duplicate of a saved expense: 12 Oct · GRAB \*TRIP · SGD 12.40",
    or "Possible duplicate of #7 (page 1 · line 22) in this statement", with
    a link that jumps to row #7.
  - Three choices, as a segmented control with the current choice shown:
    **Keep both** (save this row), **Skip** (deselect; the row stays visible,
    labelled "Skipped", and can be re-selected), **Needs amend** (the row
    stays selected but blocked, focus moves to its first field, and the
    footer asks for a recheck).
  - Decisions are reversible until save. The choice control stays active.
- **Skip** re-evaluates statement-internal duplicates locally. If skipping
  #7 leaves #12 with no partner, #12's warning clears without a network read.
- **Recheck** runs a fresh `getExpenses()` read for the stale or amend rows
  only, compared against saved records and all other selected rows. It uses
  the same blocking overlay as the check. A row that no longer matches is
  clean. A row that still matches goes back to Keep / Skip / Needs amend.
- "Go to next duplicate" switches the filter to "Possible duplicates", pages
  to the next unresolved card, scrolls it into view, focuses its choice
  control and highlights its source line in the viewer.
- Hard source issues stay non-dismissable, as in spec 136. Only duplicate
  warnings get the three choices.

### Blocking progress overlay

- New `ImportProgressOverlay`: absolute `inset-0` over the dialog body, on
  `bg-background/80` with `backdrop-blur-sm`, `role="alertdialog"`,
  `aria-modal`, `aria-busy`, and focus held on the overlay. It is shown while
  `save.busy` (check, recheck, save, check saved).
  - Check and recheck: a spinner, "Checking 12 expenses against your saved
    records…", indeterminate.
  - Save: a native `<progress value max>` styled with Tailwind
    `[&::-webkit-progress-value]` and `[&::-moz-progress-bar]` token classes
    (no inline style), plus "Saving 20 of 45 · group 2 of 3" and "Keep this
    window open." The hook exposes `progress: { done, total, group, groups }`,
    derived from attempt statuses.
  - No cancel during a save: a group in flight cannot be rolled back (spec
    136). The check can be cancelled; cancelling invalidates the operation,
    as Hide does today.
- While busy, the dialog ignores close requests: `onEscapeKeyDown` and
  `onInteractOutside` call `preventDefault`, the header X is disabled, and
  `changeOpen(false)` returns early. `beforeunload` stays as it is.
- Hide (privacy) during an operation behaves as today: it cancels the
  operation, keeps pending groups as unconfirmed, and removes the overlay.

### Completion

- When a save run ends with every attempt `confirmed` and no `not_started`
  rows, the body becomes `ImportComplete`: a check icon in `text-gain`,
  "45 expenses saved", the total, the statement period and the bank, and how
  many duplicates were kept or skipped.
- Primary button **Done** (focused on mount) closes the modal. Secondary
  button **Import another statement** goes to the Choose step.
- `allowDiscard()` returns true when every attempt is confirmed and nothing
  is selected, so Done and X close without the discard confirm.
- A partial outcome (any `not_saved`, `unconfirmed` or `conflict`) shows an
  outcome view instead. A summary line comes first. Problem rows are listed
  first, as "#14 · Page 2 · line 37 · GRAB · SGD 12.40", each with its
  existing actions (Retry same expense, Cancel rejected attempt, Check saved
  expenses, Continue frozen batch). Confirmed rows collapse into one "40
  saved" disclosure. Spec 136 retry and pause rules are unchanged.

### Statement viewer: pan, zoom, line highlight

- New `StatementViewer` component, extracted from `statement-review.tsx`.
  - Toolbar: page ‹ ›, "Page 2 of 4", zoom − / level / +, and **Fit**.
  - Zoom levels live in `constants.ts` as literal Tailwind classes, for
    example `{ fit: 'h-full w-full object-contain', 100: 'w-full', 150:
'w-[150%]', 200: 'w-[200%]', 300: 'w-[300%]' }`. Above Fit, the canvas
    keeps its aspect ratio (`h-auto max-w-none`) inside an `overflow-auto`
    container. No inline style.
  - Pan: native scrolling (wheel, trackpad, touch, scrollbars), plus pointer
    drag on the canvas that sets `scrollLeft`/`scrollTop` (DOM properties,
    not styles). It uses `cursor-grab` and `active:cursor-grabbing`.
  - Zoom input: the buttons; `+`, `-` and `0` keys while the viewer has
    focus; Ctrl/⌘ + wheel; two-pointer pinch, stepping between levels.
    Zooming keeps the point under the cursor or pinch centre in place.
  - Resolution: `LocalStatementPdf.render(page, canvas, { scale, highlight })`
    takes a target scale derived from the container width × zoom ×
    `devicePixelRatio`. It stays capped by the spec 133 limits (4,000,000
    pixels per page, 8192 px per side), so very high zoom on HiDPI screens
    may soften slightly. The existing render-cancel generation logic stays.
  - Line highlight: `positionedStatementLines` already groups text by
    baseline `y`. The local session keeps a private per-page map of line
    number to `{ y, height }` (not added to `StatementLine`, so the import
    schema and source note do not change). After rendering, `render` paints
    a translucent band over the selected row's source lines on the canvas,
    using the `--brand` token read with `getComputedStyle`. Selecting a row,
    "Compare source" or "Go to next duplicate" scrolls the highlighted band
    into view at the current zoom.

### Files

- Edit: `src/features/import-review/components/statement-review.tsx`
  (becomes the orchestrator: steps, header, layout), `statement-row-card.tsx`
  (row number, page and line, duplicate block),
  `statement-save-review.tsx` (becomes the action bar and outcome view, or
  is split into the two), `statement-source-form.tsx` (no `details` wrapper),
  `hooks/use-statement-save.ts` (per-row check state, resolution, progress,
  completion, `allowDiscard`), `lib/import-selection.ts` (match details,
  local re-evaluation), `lib/local-pdf.ts` (scale option, line geometry,
  highlight), `constants.ts` (zoom classes, step labels, copy), `types.ts`
  (`DuplicateMatch`, `DuplicateResolution`).
- New: `components/statement-viewer.tsx`,
  `components/import-action-bar.tsx`,
  `components/import-progress-overlay.tsx`,
  `components/import-complete.tsx`, and optionally
  `hooks/use-pan-zoom.ts` (pointer, keyboard and wheel logic, kept pure and
  testable).
- Tests: extend `test/features/profile/statement-review.test.tsx`,
  `statement-save-groups.test.tsx`, `statement-import.test.ts(x)`,
  `local-pdf.test.ts` and `test/features/privacy/statement-review-visibility.test.tsx`.
  Add `test/features/profile/statement-viewer.test.tsx`.
- No change to `src/features/expenses` actions, schemas or limits.

### Implementation notes (2026-10-25)

- `statement-save-review.tsx` was renamed to `import-outcome.tsx`; the action
  bar is `import-action-bar.tsx`. `possibleImportDuplicates` was replaced by
  `savedImportMatches` and `statementImportMatches`, and the unused
  `hasSourceDuplicate` export was removed.
- Statement-internal matches are computed live among eligible rows that are
  not skipped. An unselected partner still warns, as the parser flag did, and
  a skipped partner does not.
- On narrow screens the header buttons collapse to icon buttons with
  accessible labels instead of an overflow menu.
- The completion view also offers "Back to N unsaved rows" when eligible
  rows are left unsaved, so a partial selection can continue.
- Hiding amounts still clears every duplicate check, as it cleared the old
  review.

## Out of scope

- Changes to parsing, classification, the duplicate-matching rule or the save
  action and its server contract.
- Durable cross-import deduplication (still not guaranteed; the copy keeps
  saying so).
- A text layer, text selection or search in the PDF viewer.
- Raising the spec 133 render limits.
- A toast system. Completion is shown inside the modal.
- Auto-closing on success (see open question 1).
- Banks other than UOB, DBS, HSBC and Citibank.

## Acceptance

- [ ] `pnpm check` green
- [ ] `pnpm test:ci` green, with new tests for:
  - the footer shows exactly one primary button per state, with the label
    and status line in the table above, across select → check → resolve →
    save → done;
  - editing one checked row marks only that row stale; the other rows stay
    checked; the button becomes "Recheck 1 row"; the merchant-rule pass does
    the same for rows it changes;
  - duplicate cards name the matched saved expense (date, item, amount) or
    the matched row (#n, page, line), and the row link focuses that row;
  - Keep both / Skip / Needs amend per row; Skip deselects and clears a
    now-unpaired statement-internal partner without a network read; Needs
    amend blocks save until a recheck; Save is enabled only when every
    matched row is Keep; decisions change freely before save;
  - recheck reads `getExpenses` once, covers only stale or amend rows, and a
    failed read keeps them blocked;
  - pager stays rendered at the bottom of the rows pane; paging moves focus
    to the first card of the page; visible row numbers are right on page 2+
    (regression for the `rowPage` vs `currentRowPage` mismatch);
  - the overlay appears during check, recheck and save, traps focus, shows
    determinate progress for a 45-row save (three groups), and Esc, the X
    and outside clicks do not close the dialog while busy;
  - an all-confirmed save shows the completion view; Done closes the modal
    with no confirm; a partial outcome shows the outcome view with problem
    rows first and keeps the spec 136 retry, pause and check rules;
  - Change statement and Merchant rules sit in the header; Change statement
    uses the discard guard; the source form no longer renders inline after
    extraction;
  - viewer: zoom steps through the levels with buttons, keys and Ctrl+wheel;
    Fit restores; drag pans by changing scroll position; render receives the
    capped scale; the highlight band is drawn for the selected row's source
    lines; no element in the import review has a `style` attribute;
  - Hide/Show during check, save and on the completion view keeps today's
    behaviour (masked values, cancelled operations, pending → unconfirmed).
- [ ] `pnpm build` green
- [ ] Manual, local stack, with a real multi-page UOB or DBS PDF: import about
      45 rows end to end. Check: zoom to 300% and pan; resolve one saved and
      one statement-internal duplicate (one Keep, one Skip, one Needs amend
      then recheck); watch save progress; see the completion view; Done
      closes. Repeat at 390px mobile width and with the keyboard only. The
      CSP console stays clean.
- [ ] Spec hash matches at impl PR time.

## Risk & reversibility

- **Blast radius:** the statement import UI only. The save path and its
  safety rules (frozen identities, no implicit retry, pause on unconfirmed
  or conflict) are unchanged, and tests keep them pinned. The main risk is
  a regression in the per-row duplicate state that lets a matched row save
  without a Keep. Explicit tests guard this.
- **Reversibility:** one `git revert`. No data, schema or crypto change.
- **Backout plan:** revert the impl commit. Imports already saved stay valid
  because the records and source notes are unchanged.

## Open questions

Owner approval 2026-10-25: "Approve spec 154 as drafted. Q1: close on Done
only. Q2: keep empty default selection. Implement it."

- [x] Q1: Close on **Done** only; no auto-close. — Owner: Clarence — A: Done
      only.
- [x] Q2: Keep the empty default selection. — Owner: Clarence — A: empty
      selection, "Select all N expenses" first.
