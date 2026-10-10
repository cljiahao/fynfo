---
id: '097'
area: audit
status: owner-authorized
created: 2026-10-10
author: Codex
constitution_satisfies: ['§2.1', '§2.3', '§3.2', '§4.2', '§4.4', '§7.4', '§8.2']
---

# Distribution history readiness

## Owner scope and evidence before edits

Clarence authorized continued ordinary audit/remediation and parallel worktrees; root selected the confirmed distributions read-state bug from page-purpose-confirmation.md on2026-10-10. Branch impl/097-distribution-readiness starts origin/main68106d5. No new feature, dependency, migration, crypto, provider, protected-file edit or real secret/account data is included.

DistributionsSection reads only useDividends().data and replaces missing data with []; DividendTable calls that an empty history, and YieldOnCostTable internally calculates zero income/yield for no rows but filters those rows and presents an absent-yield empty state. Successful trades do not establish that the independent dividends read succeeded. A failed background dividend read may retain cached data, so an isPending-only fix is insufficient. Quote/FX availability and actual-zero behavior from084 remain unchanged.

## Affected paths and proposal

src/features/equity/components/distributions-section.tsx; new test/features/equity/distribution-readiness.test.tsx; this audit; README durable read-state clarification after root coordination. Reuse existing skeleton/status and compact DashboardError retry inside the distributions card. Keep manual Add available and the rest of equity/trades page usable. Render distribution totals/table/chart/yield only after successful dividend read; distinguish genuine successful empty history. Disable historical scan and withhold its deduplication context while history is pending/failed, including an already-open scan losing readiness. Preserve existing recorded data/action contracts and native currency/FX assumptions. No hook/query key/server action change.

## Acceptance and rollback

Mounted actual QueryClient/hook/action-boundary tests must fail baseline for pending read, initial error and cached-data error; retry restores records; successful [] retains the existing genuine-empty history/yield states; scan blocked without verified history and manual Add remains possible. Cover losing readiness while scan is open without reopening automatically after retry. Existing real equity UI/scan cases must continue. Full check/test:ci/build use isolated tracked synthetic fixture and loopback inline configuration only, aggregate metrics>80% and security floors unchanged. Root independent review and bounded synthetic UI inspection follow, before normal hooks/commit/PR. Rollback scoped code revert, no data operation.

## Guidance, docs and limits

Impeccable harden and craft-floor: essential pending/error/recovery state is visible and concise, using incumbent semantic tokens/components; no tooltip hides missing records, no new layout/surface needed. Project next-verify defines required gates. TemplateCentral/frontend-design are unavailable in this session; no substitute installation or claimed invocation. Page-purpose artifact lists exact existing tests and browser-proof gaps. README/comments will describe the resulting durable contract; no exhaustive/live authenticated verification claim.

## Results

Baseline mounted tests: three readiness regressions failed (pending initial read, failed initial read, cached-history background error) and one genuine-empty control passed. The scoped UI then passed all four regressions and the37 existing equity UI tests (41 total). An initially incorrect control expected literal0.00%; source inspection established zero rows are filtered and the rendered contract is No yield-on-cost yet; the control was corrected before implementation. Existing numerical/FX math is unchanged. Evidence097-red-baseline.log and097-focused.log in the external visualroot. Root independent source/test/audit review found no scoped blocker: success/error readiness hides cached figures, actual-query regressions distinguish failed/empty reads, and keyed scan reset prevents automatic reopening. README documents the resulting history-readiness and manual-add contract. Existing FX assumption copy remains visible; no stale narration/commented code was added. Impeccable mechanical detector returned no findings. Final pnpm check, pnpm test:ci and pnpm build passed in the isolated loopback fixture:121 test files/990 tests; statements93.21%, branches88.71%, functions90.78%, lines93.51%; stricter floors unchanged. Fixture src/test inventory exactly matches worktree source, including the one new regression file. Evidence097-gates.log and097-typecheck.log. Root's bounded actual-component browser proof passed pending/error/cached-error/value/empty states, disabled/enabled Scan, manual Add during cached failure and390px mobile width. Screenshots097-readiness-desktop-proof.jpg and097-readiness-mobile-proof.jpg live only in visualroot. Preview uses real query hooks with synthetic read adapters, no auth/provider/persistence. Error Retry was clicked but its browser adapter kept rejecting; successful retry is proven by mounted tests only. Preview server stopped. These screenshots do not prove actual Next authenticated navigation or production data. Not shipped until parent-owned PR/green-CI merge.
