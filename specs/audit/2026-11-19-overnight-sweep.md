---
id: audit-2026-11-19
slug: overnight-sweep
area: audit
status: draft # owner-authorized audit record (CONSTITUTION §7.4); findings not owner-reviewed
author: Claude
created: 2026-11-19
approved:
shipped:
impl_pr:
constitution_satisfies: ['§7.4']
constitution_overrides: []
---

# Overnight remediation sweep, 2026-11-19

## Request and scope

Clarence authorized on 2026-11-19 an overnight remediation of high-confidence bugs ("anything that you can recommend with high confidence after your confirmation sweep and deep research just go ahead to implement") under CONSTITUTION §7.4 and AGENTS §1.5. Scope is proven bug fixes only. Approval of findings is not claimed. Each finding below is appended with its own evidence, change, checks and rollback.

## Finding 1: export planner schema rejects expenseBufferPct

Evidence: `getPlannerSettings()` always returns `expenseBufferPct` (`src/features/assets/actions/planner-actions.ts:83`, `?? 0`) and `use-export-data.ts` passes the settings through, but `planner` in `src/features/profile/lib/export-validation.ts` was a `z.strictObject` without that key, so `reviewExportJson` rejected any export made by a user with planner settings. The shared `common` envelope (`plannerSettings: planner.nullable()`) covers every export version. No import apply path maps plannerSettings; the review is the only consumer, so there is no restore code to fix.

Change: add `expenseBufferPct: z.number().min(0).max(100).optional()`, matching the 0-100 clamp in `planner-settings-sheet.tsx` and `schemas.ts:47`; optional so older exports still validate.

Acceptance checks: `test/features/profile/export-validation-freedom.test.ts` covers accept with and without the key and rejects -1 and 101; the five pnpm gates are green.

Rollback: revert the commit.
