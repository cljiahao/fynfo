---
id: '158'
slug: import-row-remove
area: feature
status: approved
author: Claude Code
created: 2026-10-30
approved: 2026-10-30
shipped:
impl_pr: direct commit to main (no PR)
supersedes:
constitution_satisfies:
  - '§2.3'
  - '§2.5'
  - '§2.6'
  - '§2.7'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§4.4'
constitution_overrides: []
---

# Spec 158: Remove a row from statement import review

## Problem

Statement extraction sometimes produces rows the owner knows are junk (headers,
balance lines, a charge to ignore). Today a row can only be left unselected or,
after a duplicate check, marked "skip". Unselected junk still counts in the
source-row totals and in "select all" results, and once selected it still takes
part in the duplicate check. There is no way to take a row out of the review for
the rest of the session.

## Constitution check

- Satisfies: `§2.3` (no new action; saving still goes through the existing
  `requireUserId()` then `getVaultDekSession()` path, and removed rows are
  simply never sent), `§2.5` (the review is already client; no new
  `'use client'` file), `§2.6` and `§2.7`, `§3.2`, `§3.4`, `§4.1`, `§4.4`, `§4.2`
  (tests for the new pure function and the interaction).
- Overrides: none. No stored data, no migration, no encryption change.

## Solution shape

State location decision: the removed set lives in `useStatementSave`
(`src/features/import-review/hooks/use-statement-save.ts`), which already owns
`selection`, `resolutions`, `attempts`, `busy` and the `locked` rule. The
filtering itself is a pure function in
`src/features/import-review/lib/import-selection.ts` so it can be unit tested
without the hook.

- `lib/import-selection.ts`: add
  `withoutRemoved<T extends { id: string }>(rows: T[], removed: ReadonlySet<string>): T[]`.
- `hooks/use-statement-save.ts`:
  - New state `removed` (a `ReadonlySet<string>`, initially empty).
  - Derive `liveRows = withoutRemoved(rows, removed)` and use `liveRows`
    wherever the hook reads `rows` for decisions: `inputById` (L155-L158),
    `entries` (L160-L163, so the save count and `ready` exclude removed rows),
    and the `partners` input to `statementImportMatches` (L170-L175, so removed
    rows never pair as in-statement duplicates and never go to the
    saved-expense check). `total`, `pendingCount` and `duplicateCount` follow
    from `entries`.
  - `remove(row)`: no-op when `!privacy.canReveal()`, when `running.current`, or
    when `attemptsRef.current[row.id]` is set (locked or saved rows cannot be
    removed). Otherwise add the id to `removed`, drop it from `selection`, and
    delete its entries in `resolutions`, `checks` and `savedMatches` so a
    restored row starts clean.
  - `restore(row)`: same `canReveal` and `running` guards; delete the id from
    `removed`. The row comes back unselected and unresolved.
  - Return `isRemoved(key)`, `removedCount`, `remove` and `restore`.
  - `selectExpenses(candidates)` also filters out removed ids as a second line
    of defence.
  - `reset` clears `removed`. State is per import session; nothing is persisted.
- `components/statement-review.tsx`: row numbers stay stable because
  `rowNumbers` (L440) is computed from the full `rows`. `eligibleRows` (L478)
  feeds select-all through `selectExpenses`, which already excludes removed
  rows. The source-row summary (L692 area) shows removed rows as a separate
  "N removed" figure instead of silently dropping them. The "all" view keeps
  removed rows as stubs so they can be restored; the other views hide them.
- `components/statement-row-card.tsx`:
  - Header strip (L195-L250): add an icon button (lucide `X`) on the right with
    `aria-label={`Remove row #${number}`}`, rendered only when the row is not
    `save.locked(row.id)` and amounts are not hidden. Minimum 36px tap target,
    consistent with the checkbox label.
  - When `save.isRemoved(row.id)` the card renders a one-line stub:
    `Row #N removed · Restore`, where Restore is a link-variant button with
    `aria-label="Restore row #N"`. The card body, checkbox and Compare button are
    not rendered while removed, so removed content is not read by assistive
    technology. When amounts are hidden the stub shows only the row number.
- No server action, API route or encryption path is touched.

## Out of scope

- Persisting removals across sessions or after a refresh.
- Removing rows that are locked or already saved.
- Bulk remove, or an undo toast.
- Changing the parser so junk rows are never produced.
- Any change to the duplicate-check server action or `getExpensesInRange`.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new tests:
  - RTL (jsdom) in the style of `test/features/profile/statement-import.test.tsx`:
    removing a row collapses it to "Row #N removed" with a Restore button;
    select-all after removal selects the remaining eligible rows only; the
    inputs passed to the duplicate check and to the save call exclude the
    removed row; the save count excludes it; Restore returns the row unselected;
    removing a selected row clears its selection; a locked or saved row shows no
    Remove button; the Remove button's accessible name is "Remove row #N"; with
    amounts hidden no Remove button is offered
  - unit test for `withoutRemoved` (empty set returns all, order preserved,
    unknown ids ignored)
- [ ] `pnpm build` green
- [ ] Manual: import a statement, remove a row, run "Check possible duplicates"
      and confirm the removed row is not listed; restore it

## Risk & reversibility

- **Blast radius**: the import review screen only. Removal is a view and
  selection filter; no data is deleted anywhere.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the implementation commit on `main`.

## Open questions

- [ ] Q: Should removed rows in the "all" view stay visible as stubs (proposed),
      or vanish with only a footer "N removed · Restore all"? — Owner: Clarence
      — A: One-line stub "Row #N removed · Restore" in place (proposed).
