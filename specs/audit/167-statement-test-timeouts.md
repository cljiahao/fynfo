---
id: 167
slug: statement-test-timeouts
area: fix
status: shipped
author: Claude
created: 2026-11-02
approved:
shipped: 2026-11-02
impl_pr:
constitution_satisfies: ['§4.1', '§7.4']
constitution_overrides: []
---

# Audit167: Statement review tests time out under the pre-push coverage run

## Request and scope

Clarence authorized this remediation in chat on 2026-11-02 under CONSTITUTION §7.4 and AGENTS §1.5. Approval of findings is not claimed. Affected paths: `test/features/profile/statement-review.test.tsx`, `test/features/profile/statement-import.test.tsx` and this record. No production code, config, dependencies or governance files are touched.

## Evidence

The pre-push hook runs `vitest run --coverage`. Three tests exceeded their timeouts there while passing without coverage: review "hides repayments, filters refunds and bulk-selects" (46.5s vs 30s), review "pins the row pager" (26.6s vs 15s) and import "selection across pages ... twenty-one rows" (20.4s). A fourth, import "checks a hidden interrupted save", failed in `selectAndCheck`; it passes alone and passes once the preceding test no longer times out, so it was knock-on from the timed-out test, not an independent defect. Running only the three heavy tests with coverage still took 23-42s, so the cost is rendering twenty dense cards (testing-library role/label queries over jsdom under V8 instrumentation), not contention.

## Change

Both files mock `STATEMENT_ROWS_PER_PAGE` to 5 so multi-page behaviour is exercised with a small DOM. Review fixtures shrink from 22 to 7 expenses with matching totals and page labels. The import test keeps 21 rows (the save group size of 20 is separate and unchanged), selecting page by page before paging. Per-test timeout overrides are removed; all assertions are retained.

## Acceptance

Full `pnpm exec vitest run --coverage` passes twice; `format:check`, `lint` and `typecheck` pass. The real page size of 20 is no longer exercised in these two files.

## Rollback

Revert the commit.
