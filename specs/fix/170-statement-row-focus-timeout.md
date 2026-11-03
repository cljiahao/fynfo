---
id: 170
slug: statement-row-focus-timeout
area: fix
status: approved # draft | approved | shipped | superseded
author: claude (sonnet 5.5, 2026-11-03)
created: 2026-11-03
approved: 2026-11-03 # Clarence, 2026-11-03, in chat: fix the flaky statement-row-focus test / reduce the timeout
supersedes:
constitution_satisfies:
  - '§4.2' # test-only change
constitution_overrides:
---

# Spec 170: Speed up the statement-row-focus pagination test

## Problem

`test/features/profile/statement-row-focus.test.tsx` "excludes removed stubs from the all-view pagination text" renders 22 statement rows to cross the 20-row page size and carries a 30_000 ms timeout override. It still times out (~35 s) under `vitest run --coverage` in the pre-push hook.

Measured without coverage (jsdom): extraction render ~1.4-6 s and the remove re-render ~5 s for a 20-row page; query cost (`getByRole` vs label) was minor. The cost is rendering a full page of row cards, not the queries.

## Constitution check

- Owner authorization: Clarence, 2026-11-03, in chat. Scope is this one test file.

## Solution shape

- Mock `@/features/import-review/constants` in this test file so `STATEMENT_ROWS_PER_PAGE` is readable per test (default 20, reset in `beforeEach`); the pagination case uses a page size of 3 with 5 rows and asserts `Rows 1–3 of 5` then `Rows 1–2 of 4`, the same "removed stub is excluded from the count" behaviour.
- Use `getByLabelText`/`findByLabelText` for the Remove buttons (they are `aria-label`ed) instead of role queries.
- Remove the 30_000 ms override.

## Out of scope

Production code, vitest config, other test files.

## Acceptance

- The case passes under the default timeout, with and without `--coverage`, in well under 5 s.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green.

## Risk & reversibility

Test-only; revert the commit. The page-size mock means the real 20-row constant is not exercised by this case, but the pagination math is independent of the value.

## Open questions

None.
