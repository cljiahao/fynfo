---
id: 144
slug: focused-overview-and-entry
area: fix
status: shipped
shipped: 2026-10-15
impl_pr: https://github.com/cljiahao/fynfo/pull/64
author: Codex
created: 2026-10-15
constitution_satisfies: ['§2.4', '§2.5', '§2.6', '§3.1', '§4.1', '§7.4']
constitution_overrides: []
---

# 144: Focus the overview and snapshot entry

## Owner authorization

Clarence repeated the request to review every page for minimalism, guided onboarding, short pages, few nested controls, a high-level dashboard and latest asset/salary/expense records. This follow-up is explicitly owner-authorized reversible UI remediation under §7.4. It builds on shipped 143; no new dependency, persistence, crypto or protected-file changes.

## Inventory and evidence before edits

Dashboard composition and LatestRecords currently show three date rows plus eight figures, including detailed projections; the empty-account prompt appears after the record summary. Asset and salary summaries already have domain-specific components. SnapshotForm renders all seven categories, including blank rows initialized by useSnapshotEditor; this makes a short first snapshot look like a long mandatory form. SnapshotForm owns one revision-checked save; category navigation must not change that contract.

All 11 routes are accounted for: dashboard gets the focused summary; assets/salary retain detailed metrics in their existing overview/trends views; snapshot entry gets a flat category selector. Expenses/equity retain the shipped task views; Profile/export, household, admin, login and landing retain their focused structures and 143 refinements. Do not rewrite unchanged screens merely to create a diff.

Affected paths: dashboard overview composition, overview/components/latest-records.tsx, assets/salary page compositions and summary consumers, assets/components/snapshot-form.tsx, review/index.ts exporting the existing pure monthly review calculation, related tests, and this record. Existing pages consume feature barrels; the overview and snapshot form remain client components for existing query/form state. No new fetch boundary. Read-only shared-spending calculation reuses the existing monthly-review function, with clear recorded-period labels and privacy masking.

## Changes

Combine the dashboard's latest record periods and figures into three plain sections: latest total assets, latest base salary, and current Singapore-month recorded spending (personal share). Keep pending/error/empty states distinct, retries available, and dates honestly described as record periods, not last-write timestamps. Show the first-record prompt first. Move detailed asset and salary summary metrics to their own pages; calculations remain unchanged.

Use one flat category selector in snapshot entry. Keep every category's inputs mounted and registered so switching preserves values; no nested accordion. Keep one save action below the selected category. Retain browser validity constraints (including numeric badInput, step and minimum) by checking validity before Zod submission; use noValidate only to prevent the browser blocking focus on a hidden category. On failed validation reveal the first category with an invalid entry and focus its field so the error is visible. Preserve amount hiding, duplicate guards, revision checking and uncertain-write recovery. Labels identify categories and input errors; avoid adding required steps for empty categories.

## Acceptance and verification

Meaningful tests cover three-summary hierarchy, empty/error/loading distinction, latest-period ordering, Singapore month boundary, personal-share spending and masking. Snapshot tests cover preserving fields across categories, saving all categories, and revealing errors in a hidden category. Existing snapshot conflict/privacy suites remain applicable. Independent review, bounded synthetic desktop/mobile inspection and full normal gates before PR/merge. No live private data used. README setup remains valid; no new setup instruction.

## Rollback and limits

Ordinary source revert; no schema rollback. Existing historical financial calculations are preserved, not audited as financial advice. Record periods cannot prove completeness or when a record was added. Long lists of accounts within a category can still scroll; the UI does not discard or paginate unsaved fields. No exhaustive security or production-state coverage claim.

## Results

Initial targeted run: 46 tests in five suites passed (overview, latest records, snapshot interactions/conflicts/privacy). Independent review caught loss of native step/badInput validation under noValidate; fixed by checking browser validity before Zod/save and revealing/focusing the affected category. The subsequent 34-test snapshot/conflict/privacy run passed, including new precision and malformed-number cases. Reviewer confirmed the finding resolved with no remaining blockers.

Synthetic browser inspection used actual LatestRecords and SnapshotForm with synthetic data/hooks at 1280px and 390px. The three-summary preview fit a 390x844 viewport without horizontal overflow; the single-account snapshot kept Save visible. Entering 12.345, switching category and saving returned to the owning field with a precision error; entering '-' likewise showed a valid-amount error and focused the field. No actual financial records or authentication used. The preview shell substitutes navigation/data and is not an authenticated production test. Browser tab and server closed after the bounded inspection. README setup remains unchanged. Full normal gates passed: build, format, lint, typecheck and 2,070 tests across 184 suites. Exact-head hosted CI and Vercel preview passed before PR 64 merged.

Documentation closeout scope: update this shipped record and README.md after merge. The README still attributed tax-relief estimates to the dashboard after detailed salary summaries moved to Salary / Trends. Correct that location only; documentation formatting and diff review apply under §7.4. Rollback is an ordinary documentation revert.
