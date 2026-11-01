---
id: '161'
slug: import-review-row-remove-a11y
area: feature
status: draft
author: Claude Code
created: 2026-11-01
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§2.6'
  - '§2.7'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§4.4'
constitution_overrides: []
---

# Spec 161: Import review row remove — announced counts, focus, stale state

## Problem

Spec 158 added "Remove row" to statement import review. Three defects remain.
A screen-reader user hears source-row and status counts that still include
removed rows. After pressing Remove with the keyboard, focus drops to `body`
because the button unmounts, so the user must tab through the whole review
again. And removing several rows quickly can resurrect a removed row or a stale
selection, because `remove` writes state computed from an old render.

## Constitution check

- Satisfies: `§2.6` and `§2.7`, `§3.2`, `§3.4`, `§4.1`, `§4.4`, `§4.2`
  (regression tests for each fix).
- Not affected: `§2.3` (no server action/API/encryption path), `§2.5` (no new
  'use client' file).
- Overrides: none. No stored data, migration or new dependency.

## Solution shape

Files are under `src/features/import-review/`. Line numbers are current on
`main` at the time of writing.

### A. Announced counts must reflect remaining rows only

Current behavior:

- `components/statement-review.tsx:694-698`: the `sr-only` live region reads
  `{mask(rows.length)} source rows: {counts('candidate')} expense suggestions,
{counts('unresolved')} unresolved, {counts('excluded')} excluded` and then
  appends `, N removed`. `rows.length` is the full list, so removed rows are
  counted as source rows.
- `components/statement-review.tsx:537-538`: `counts(status)` filters
  `reviewedRows` (built from all `rows`, L436), so a removed row still adds to
  its status bucket.
- `components/statement-review.tsx:822-828`: the pagination `aria-live` text
  `Rows X-Y of {filteredRows.length}` counts removed stubs in the "all" view
  (`rowsFor('all')` returns every row, L453-L454).

Change:

- Derive `liveReviewedRows` as `reviewedRows` without rows where
  `save.isRemoved(row.id)` is true, in `statement-review.tsx`, and use it in
  `counts`.
- Announce `mask(liveReviewedRows.length)` as the source-row figure. Keep the
  `, N removed` suffix so the removal itself is still announced.
- Pagination text: count only non-removed rows in both the range and the total
  when the active view is "all" (removed stubs remain visible but are not rows
  to review). Other views already exclude removed rows (L455).
- Any visible source-row summary uses the same derived figures so sighted and
  screen-reader totals agree.

### B. Focus must move to a sensible control after Remove

Current behavior:

- `components/statement-row-card.tsx:250-258`: the Remove button calls
  `save.remove(row)` and then the card re-renders as the stub
  (`statement-row-card.tsx:108-131`), unmounting the button that had focus. In
  the other views the card disappears from `rowsFor` entirely
  (`statement-review.tsx:455`). Either way focus falls to `body`.
- `statement-review.tsx` already implements a post-render focus hand-off (the
  `focusTarget` ref and the effect that reads it, which focuses
  `${id}-${rowId}-card` or its decision button). It is only used for
  duplicate-compare focus, not for removal.

Change:

- Give each Remove button a stable id, `${controlId}-${row.id}-remove`, and the
  stub's Restore button (in `statement-row-card.tsx`, aria-label
  `Restore row #${number}`) a stable id, `${controlId}-${row.id}-restore`.
- In the review component, wrap removal in a handler that, before calling
  `save.remove(row)`, computes the focus target from the current `visibleRows`
  (the page and filter the user sees): the next row that will still render a
  Remove button (not removed, not locked, amounts not hidden), else the previous
  such row, else the removed row's stub Restore button when the stub stays on
  screen (the "all" view), else the stub card itself when no Restore button is
  rendered, else the `list` section (`statement-review.tsx`, made focusable
  with `tabIndex={-1}`) as the last resort when no stub is rendered.
- The stub card fallback needs no new code: the stub already has
  `tabIndex={-1}` and id `${controlId}-${row.id}-card`
  (`statement-row-card.tsx`), and the focus effect already resolves `-card`
  ids. It is a defensive branch: `remove` returns early when
  `!privacy.canReveal()`, so it only fires if amounts become hidden between the
  click and the render.
- Focusing the `list` section is best-effort: on small screens the section is
  `hidden` when `view !== 'extracted'`, so it cannot take focus there. Tests use
  the default jsdom viewport.
- Store the target as an element id in a ref and focus it in the existing
  post-render effect. Extend `focusTarget` (or add a sibling ref) to carry an
  id, so the single effect stays the only place that focuses.
- Focus is only moved when the Remove button itself had focus, so a pointer
  user is not pulled around.
- `remove` stays a no-op when its guards fire, and no focus move is queued in
  that case.

### C. `remove` and `restore` must not read stale state

Current behavior:

- `remove` in `hooks/use-statement-save.ts` calls
  `setRemoved(new Set(removed).add(row.id))`,
  `setSelection(selection.filter(...))`, `setResolutions(drop(resolutions))`,
  `setChecks(drop(checks))` and `setSavedMatches(drop(savedMatches))`. All five
  read the values captured by the render that created the handler. Two removes
  fired before React commits between them (rapid clicks, or key repeat) each
  start from the same old snapshot, so the second write overwrites the first
  and the first row reappears and may stay selected.
- `restore` in the same hook has the same pattern with
  `new Set(removed)`.

Change:

- Rewrite both with functional updates:
  `setRemoved((current) => new Set(current).add(row.id))`,
  `setSelection((current) => current.filter((key) => key !== row.id))`, and the
  same for the three records via the `drop` helper applied to the updater
  argument. `restore` uses `setRemoved` with an updater that copies `current`,
  deletes `row.id` and returns the copy.
- The guards (`canReveal`, `running`, `attemptsRef`) are refs or non-state reads
  and stay as they are.
- Not in this spec: the same closure pattern in `toggle`, `resolve` and
  `clearSelection`. They are not part of the remove flow; record a
  follow-up if the owner wants them converted.

## Out of scope

- Changing the visual layout of the review, the stub text, or remove/restore
  behavior beyond focus and counts.
- Undo toast, bulk remove, persistence of removals.
- Converting `toggle`, `resolve` and other handlers to functional updates.
- Any server action, API route, migration or encryption change.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new tests (jsdom via `// @vitest-environment jsdom`
      per file, Testing Library, in the style of
      `test/features/profile/statement-row-remove.test.tsx`):
  - A: after removing one of N rows, the `sr-only` status text reports N-1
    source rows and the matching per-status counts plus "1 removed"; restoring
    brings the counts back; the pagination text in the "all" view excludes
    removed stubs; with amounts hidden the figures stay masked
  - B: with the Remove button focused, removing a middle row focuses the next
    row's Remove button; removing the last row focuses the previous row's;
    removing the only remaining row focuses the removed row's Restore button
    (`Restore row #N`) in the "all" view and the list section in the "expenses" view; locked or already removed
    neighbours are skipped; `document.activeElement` is never `body`; focus is
    not moved when the removal was not triggered from keyboard focus on that
    button; with amounts hidden after the remove and no focusable neighbour,
    focus lands on the stub card (`${controlId}-${row.id}-card`)
  - C: hook-level test with `renderHook` that calls `remove` for two rows inside
    a single `act` and asserts both ids are in `removed` and neither is in
    `selection`; same for two `restore` calls; the dropped
    resolution/check/saved-match entries stay dropped for both rows
- [ ] `pnpm build` green
- [ ] Manual: with a screen reader, remove a row and hear the updated totals;
      remove rows by keyboard only and confirm focus never leaves the list
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: the statement import review screen only. No data is stored
  or deleted.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the implementation commit on `main`.

## Resolved decisions

Owner: Clarence, 2026-11-01.

- The announced source-row total excludes removed rows
  (`mask(liveReviewedRows.length)`); the `, N removed` suffix stays.
- In the "all" view, when no row can take focus, focus goes to the removed
  row's stub Restore button, not the list section. The list section is only the
  last resort when no stub is rendered.

## Open questions

None.
