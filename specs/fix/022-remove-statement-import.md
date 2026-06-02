---
id: 022
slug: remove-statement-import
area: fix
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence: remove it (MAS-sensitive, ruled out)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§2.1' # removes an unwanted bank-statement upload surface
constitution_overrides:
---

# Spec fix/022: Remove the bank-statement import feature

## Problem

`StatementDialog` is mounted on the expenses page (`dashboard/expenses/page.tsx`) and accepts CSV
bank-statement uploads via `processStatement` → `parseStatement`. The owner has ruled this feature out
on regulatory grounds (Singapore/MAS — users should not be uploading bank statements), so it is a
**shipped, unwanted, compliance-sensitive surface**. It also drags in two runtime deps: `papaparse`
(used only here) and `pdf-parse` (zero usages anywhere — already dead).

## Constitution check

- Satisfies `§2.1` (removes an unwanted data-ingestion surface). Overrides: none. Removes a feature +
  dependencies; no migration, no encryption-path change. Net **−deps**.

## Solution shape

- Delete: `features/expenses/actions/statement-actions.ts`,
  `features/expenses/components/statement-dialog.tsx`, `features/expenses/lib/statement-parser.ts`,
  `test/features/expenses/statement-parser.test.ts`.
- Edit `features/expenses/components/index.ts`: drop the `StatementDialog` export.
- Edit `app/dashboard/expenses/page.tsx`: remove the `StatementDialog` import + mount, the
  `statementOpen` state, the "Import Statement" button, and the now-unused `FileUp` icon import.
- Remove deps: `papaparse`, `pdf-parse`, `@types/papaparse`, `@types/pdf-parse`.

## Out of scope

- The expenses page keeps quick-add + table + chart + owed-summary unchanged.
- No replacement import mechanism (intentionally none).

## Acceptance

- [x] `pnpm check` + `pnpm test:ci` + `pnpm build` green; no dangling imports/exports.
- [x] `papaparse` / `pdf-parse` (+ `@types`) gone from `package.json`; no remaining references.
- [x] Expenses page renders without the statement button/dialog.

## Risk & reversibility

- **Blast radius**: expenses page (loses the import button) + removed deps. No data model change; no
  existing data affected.
- **Reversibility**: `git revert` restores files + deps (`pnpm install`).
- **Backout plan**: revert the commit.

## Open questions

- None.
