---
id: 168
slug: slim-heavy-tests
area: fix
status: draft # owner-authorized audit record (CONSTITUTION §7.4); not merged
author: Claude
created: 2026-11-03
approved:
shipped:
impl_pr:
constitution_satisfies: ['§4.1', '§7.4']
constitution_overrides: []
---

# Two workflow tests sit near the 5s default under the pre-push coverage run

## Request and scope

Clarence authorized this remediation in chat on 2026-11-03 under CONSTITUTION §7.4 and AGENTS §1.5. Approval of findings is not claimed. Affected paths: `test/features/assets/overview-workflows.test.tsx`, `test/features/profile/statement-import.test.tsx` and this record. No production code, config, dependencies, timeouts or governance files are touched.

## Evidence

A quiet full `vitest run --coverage` measured only two tests above 2s: the overview "connects calculated market budgets ..." test (2.3s, which timed out above 5s in the last pre-push) and the import "selection across pages ... twenty-one rows" test (2.7s, carrying a 20s override added in 167). Both chain many interactions and queries in one test, so under load they approach the global 5s `testTimeout`.

## Change

Each long workflow is split into focused tests that arrange their own starting state. Setup queries use cheaper lookups (text and attribute selectors instead of accessible-name role queries, which scan the whole DOM per call); assertions keep their text and values, except that `toBeVisible` becomes `toBeInTheDocument` in the cross-page selection test because visibility checks walk computed styles. The overview file stubs `@/lib/recharts`, because no test there asserts chart output. The import 20s override is removed.

Mapping, overview (old -> new):

- Allocation edits, `fynfo-allocations` not persisted, `fetchStockPrices` args -> "connects calculated market budgets to real ticker allocation edits without persisting sensitive targets"
- Salary 8000 and allocations 50/100 retained after snapshot read failure and "Try again" -> "keeps planner salary and allocation edits after a snapshot read is retried" (starting edits are arranged by `enterPlannerEdits`)
- Salary 8000 and DBS 100 retained after expense read failure and "Retry" -> "keeps planner salary and allocation edits after an expense read is retried"

Mapping, statement import (old -> new):

- 20 selected after paging, 21 selected after line 22, check, "Save 21 expenses", "21 expenses saved", 21 inserts in automatic groups -> "selection across pages is included and twenty-one rows save in automatic groups". The test is one flow but now carries only the paging loop with plain DOM selection and cheaper text queries, so it stays well under the default timeout.

## Acceptance

Full `pnpm exec vitest run --coverage` passes; `format:check`, `lint` and `typecheck` pass. Per-test durations are reported in the delivery notes, not asserted here.

## Rollback

Revert the commit.
