---
id: '148'
slug: snapshot-quick-entry
area: feature
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-10-23
approved: 2026-10-23
shipped: 2026-10-23
impl_pr: https://github.com/cljiahao/fynfo/pull/69
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§4'
constitution_overrides:
---

# Spec 148: Carry last month's amounts into a new snapshot

## Problem

A new monthly snapshot keeps last month's account names but clears every
amount. Most balances (bonds, CPF, fixed deposits) barely move month to month,
yet the owner must look each one up and retype it. Every amount field shows
`0.00`, so there is no hint of last month's figure. If the current month
already has a snapshot, the form only says so and disables Save; there is no
direct way to edit that month instead.

Owner direction (2026-10-23): keep the friction of adding snapshots low across
every page. Approved under the owner's standing go-ahead for non-security work
given on 2026-10-23.

## Constitution check

- Satisfies: `§1.1` (personal dashboard, owner-entered snapshots), `§4`
  (feature code in `features/assets`, no new dependency).
- Overrides: none. No schema, server action, encryption or validation change.

## Solution shape

- `src/features/assets/hooks/use-snapshot-editor.ts`: when creating (no
  `editId`), expose `previousAmount(category, account)` from the latest saved
  snapshot, and `copyPrevious()`, which fills each blank amount with last
  month's value for the same category and account. Edited amounts are never
  overwritten.
- `src/features/assets/components/snapshot-form.tsx`:
  - Amount placeholder shows last month's value for carried rows (for example
    `Last: 1,234.00`), and `0.00` otherwise.
  - A "Copy last month's amounts" button appears when creating and a previous
    snapshot exists.
  - When the selected month already has a snapshot, the duplicate notice links
    to `/dashboard/entry?edit=<month>`.
- Blank amounts still save as `0`, as today. The placeholder is a hint, not a
  value.
- `src/features/salary/components/salary-form.tsx`: a new record prefills
  Gross Salary with the latest saved month's salary, since it rarely changes.
  Bonus stays blank. If the selected month already has a record, the dialog
  says that saving replaces it (the action is an upsert today, and that
  overwrite was previously silent).

## Out of scope

- Snapshot and salary schema, actions and conflict handling.
- Equity and household pages. They get their own records if the friction
  audit finds equivalent issues.

## Acceptance

- [x] Regression tests: placeholder shows the previous amount; copy fills only
      blank amounts; copy is hidden when editing or with no history; duplicate
      notice links to the edit route; a new salary record prefills the latest
      salary and warns before replacing an existing month.
- [x] Existing snapshot conflict and duplicate tests stay green.
- [x] `pnpm check && pnpm test:ci && pnpm build` green.
- [x] Manual on the local test stack (spec 147): save month A, start month B,
      copy, change one amount, save, and confirm B's totals.

## Results

Shipped in PR 69. New `snapshot-quick-entry.test.tsx` (4 tests) and two salary
interaction tests. Gates green: 2112 tests, build. Live on the local stack:
saved September (Bank $5,000, SSB $2,000), opened October, copied, changed only
Bank to $5,200 and saved; Assets showed $7,200 and a +$200 savings change.
Testing found that records loading after the salary dialog opened re-ran its
reset and dropped the chosen month; the prefill now only fills an untouched,
blank salary field.

## Risk & reversibility

- **Blast radius**: snapshot create form only. Saved data format unchanged.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the implementation commit.

## Open questions

None.
