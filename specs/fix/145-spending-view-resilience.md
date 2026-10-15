---
id: 145
slug: spending-view-resilience
area: fix
status: draft
author: Codex
created: 2026-10-15
constitution_satisfies: ['§2.4', '§2.5', '§2.6', '§3.1', '§4.1', '§7.4']
constitution_overrides: []
---

# 145: Spending view resilience

## Owner authorization and review boundary

Clarence requested continuing to ensure Fynfo is proper after the 143/144 UX work. This is owner-authorized audit/remediation under §7.4. Preserve the minimalist interface and existing product scope. No schema, dependency, encryption, protected-file or refund-storage change.

Reviewed the 143/144 page compositions (dashboard, assets, salary, expenses, equity), mounted PageViews, SnapshotForm, LatestRecords, chart and owed-summary consumers, expense schema/import constraints, monthly review and split allocation helpers, related regression tests and README. Existing independent reviewer checked mounted panels, dialog ownership, charts, snapshot validation and privacy without finding a new blocker. This is a bounded integration review, not exhaustive whole-repository or live-account certification. Existing auth/vault and encrypted action boundaries are not altered; input validation remains at the save boundary. No secrets or live financial records used.

## Evidence and pre-edit remediation scope

ExpenseChart returns null for an empty history, while OwedSummary also returns null; Spending therefore presents a blank panel for a new account. The chart uses browser-local months although the dashboard and anomaly review use Singapore months. Floating-point subtraction and summation differ from the cent-based monthly review, and legacy overallocated shares can yield misleading negative totals rather than an unavailable result. The chart heading and total use a nonwrapping horizontal header on narrow screens. Refund storage is not supported by the positive-only expense schema; negative-refund rendering is not a supported-flow defect and is not being expanded.

Affected paths: expenses/components/expense-chart.tsx, a pure expenses/lib/expense-chart.ts helper, existing expense-editing tests, focused calculation/chart regressions, and this record. Extract current chart aggregation, anchor its twelve-month window to Singapore, calculate personal shares in cents and reject invalid historical allocations. Preserve all-time average semantics (months with records) and twelve-month average semantics (months with positive personal spending). Show a short empty/error state and stack the header on small screens. No new fetches or writes. The empty state points to the existing Transactions view rather than creating a competing entry flow.

## Acceptance and rollback

Regressions cover Singapore month/year boundaries, shared allocations including settled shares and cent arithmetic, invalid historical amounts/splits, empty chart guidance and amount masking. Independent code review, bounded synthetic mobile/desktop inspection and full normal quality gates before PR/merge. Review README and comments against resulting behavior. Rollback is an ordinary source revert with no data migration. Retain existing positive-only expense contract.

## Results

## Owner-directed layout refinement

During verification Clarence requested the Assets-style layout: Spending default, Quick add / Import statement below its overview, and Transactions containing the table. Before this batch, extend affected paths to expenses/page.tsx, expenses-skeleton.tsx, ExpenseEntry, ExpenseQuickAdd, PageViews and reuse/page-view tests. Keep mounted panels and preserve drafts. Add controlled selection to PageViews so Reuse can reveal Quick add; cancellation must reveal and focus its source table action. Retain standalone ExpenseEntry behavior for its existing integration consumers. Update empty-state guidance for the relocated entry controls. Reduce mobile chart height to keep the entry choices nearer the overview. Verify default view, separation, switching drafts, reuse activation/cancellation focus and the previous financial guards. Existing gates will rerun on final source. Ordinary source revert is rollback.

Impeccable source detector on ExpenseChart returned no findings; source review identified the behavior gaps above. No measured performance or WCAG certification claim. Focused regressions passed: 25 tests in two suites. Independent review found no actionable blockers. Synthetic browser inspection verified the populated chart at 390px and 1280px, empty guidance, and the unavailable state in dark mode. Fixture uses actual chart components with synthetic data and blocked server boundaries; it is not a live authenticated test. Browser tab closed and viewport reset. README setup and documented expense contracts remain valid. Full normal gates pending.

Layout results: 53 tests across four suites passed, covering default Spending, table separation, draft/mode preservation, Reuse activation and cancellation focus. Independent reviewer found no actionable blockers. Synthetic desktop/mobile checks verified entry beneath the overview, table-only Transactions, retained draft and import access. Mobile chart height reduced to 240px; desktop retains 350px. The earlier full pre-push run was interrupted when the owner changed scope; it is not counted as final verification. Full gates rerun on the resulting source.
