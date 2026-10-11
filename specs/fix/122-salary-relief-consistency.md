---
id: '122'
slug: salary-relief-consistency
area: fix
status: draft
author: Codex
created: 2026-10-11
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  [
    '§2.1',
    '§2.2',
    '§2.3',
    '§2.4',
    '§2.6',
    '§3.2',
    '§4.1',
    '§4.2',
    '§4.4',
    '§7.4',
    '§8.2',
  ]
constitution_overrides: []
---

# 122: Use saved tax reliefs consistently in salary estimates

## Problem

Dashboard salary tax cards call the shared calculation hook with zero additional reliefs, while salary details receive saved reliefs indirectly through a closed editor's initial callback and local mirror. Identical records/profile can produce different projected tax. Pending or failed saved-relief reads are not part of displayed estimate readiness. This ordinary correction is selected under Clarence's continuing audit and stabilization-first direction, Constitution §7.4; root reviewed the concrete six-path contract before edits. Approval remains blank rather than claiming agent approval of a new feature.

## Constitution check

Encrypted actions, identity/vault gates and models remain unchanged (§2.1–§2.3). Existing feature hooks own reads and pages remain unchanged (§2.4/§2.6). Reuse existing controls/tokens and named exports; no dependency, inline styling, suppression or new client boundary (§3.2). Meaningful regressions, full gates, stricter existing floors and fresh review remain required (§4.1/§4.2/§4.4). No protected, schema, crypto or approval-history change (§7.4/§8.2).

## Solution shape and exact pre-edit scope

Exactly six ordinary paths, recorded before any test/product edit:

1. `specs/fix/122-salary-relief-consistency.md` — owner-authorized audit/results.
2. `src/features/salary/hooks/use-salary-ytd-stats.ts` — read the existing same-year relief query; derive saved labels/total with existing buildInitialState/buildReliefItems/computeTotal helpers, expose readiness/retry and preserve existing engines.
3. `src/features/salary/components/salary-summary.tsx` — use saved hook items instead of callback/local mirror; visible relief loading/error/retry alongside retained income/profile/CPF behavior.
4. `src/features/salary/components/salary-summary-cards.tsx` — use the same saved estimate, unavailable marker/readiness hint and existing small retry affordance.
5. `test/features/salary/salary-interactions.test.tsx` — meaningful actual hook/card/detail/editor/action-boundary regressions in the existing suite.
6. `README.md` — concise consistent saved-relief/readiness contract.

The existing same-year Query key and mutation refresh are reused; no manual cache fan-out. Successful empty data means confirmed zero; resident pending/error (including error with stale data) hides estimates, while income remains available. Nonresident calculations ignore irrelevant personal-relief failures. Unsaved editor drafts/cancellation/failed writes must not change persisted estimates; successful refresh updates both consumers. Keep TaxReliefsDialog and its optional onConfirm semantics byte-identical; SalarySummary no longer passes that callback. Query lifetime/security remains owned by existing 095 boundaries.

## Out of scope

Tax/CPF rate/model changes, relief editor redesign or callback-contract change, new query key/defaults, actions/schema/SQL/crypto/dependencies, protected files, unrelated metadata closeout, production/private access and latency claims. No completed-roadmap or whole-project sweep claim.

## Acceptance

- [ ] Actual mounted numeric regression fails shipped source: resident/non-NSman/birth1990/year2026/salary5000 and saved SRS100 require projected card/detail tax1033; old card1040 must fail numerically.
- [ ] Delayed/error/stale-error reads hide resident tax, preserve income and offer failed-source retry; empty reliefs confirms tax1040. Nonresident/profile/unsupported CPF/no-record behavior remains intact.
- [ ] Actual editor unsaved/canceled/failed SRS draft keeps tax1033; successful saved SRS200 refresh yields1026 in both consumers, preserving mutation payload.
- [ ] Same-year observers share existing cache/read; meaningful late/clear controls retain existing identity lifetime without altered query defaults.
- [ ] Existing callback tests remain unchanged; no mock hides real persisted-query wiring or supplies real environment.
- [ ] Full check/test:ci/build, coverage above80% in every metric and unchanged security floors; independent review and bounded actual Next qualification before green-only PR merge.
- [ ] README/comments reviewed; retained material model assumptions and source states remain visible.

## Risk and reversibility

Only salary estimate consumers and saved-relief readiness change. More truthful resident estimates can remain unavailable during a failing relief read instead of treating missing input as zero. Revert the six-path batch; saved/encrypted records stay unchanged. No migration rollback.

## Open questions

Root resolved the six-path scope and preserved editor callback contract. No security/data-model ambiguity or new dependency remains. Heavy gates/builds wait coordinated slot release; no commit/PR before review and gates.

## Investigation, skills and evidence

Read full Constitution/template and supplied AGENTS, actual hook/consumers/relief helpers/query/actions and existing callback/query-refresh tests. Only SalarySummary and SalarySummaryCards consume useSalaryYtdStats. Existing hook tests do not mock this shared hook; use actual existing action mocks for regressions. Read Impeccable harden/craft-floor guidance for incumbent loading/error/retry and accessible controls; session context was already run by root and is not repeated. TemplateCentral/frontend-design callable skills are unavailable here; no invocation/install is claimed. Reuse existing StatCard children and Button rather than creating a widget.

A read-only pure existing-engine control confirmed projected gross60000/CPF12000/EIR1000/tax1040 without additional reliefs and chargeable46900/tax1033 with SRS100. This is model input evidence, not financial advice, auth/SQL or observed production output. Baseline and implementation results follow after coordinated light verification.

## Results

Recorded before test/product edits on impl/122-salary-relief-consistency from verified merged main422b9ff28d5d1b8a9e7cff42b0ca75ac1b90ab63. The numeric shipped-source baseline failed on the actual card value (one failed, 20 other cases skipped), retained in `122-baseline-red.log`. Root separately observed the same synthetic Next mismatch: dashboard tax 1,040 versus salary detail 1,033 with saved SRS 100. Neither observation proves production authentication or database behavior.

Corrected focused readiness/editor tests passed 27 cases before the additional late-clear regression; scoped TypeScript and ESLint both exited zero. Final focused/whole-suite results follow after coordinated verification. Earlier local test attempts exposed harness assumptions: the new tests now use the unchanged production five-minute stale policy for same-year read sharing, and modal-hidden regions are queried only to check retained estimates during drafts. Original existing tests keep their previous cache settings.

The dashboard now reads persisted tax reliefs, which it previously omitted. Existing same-year Query cache shares this read with details and the editor; core SSR keys, query defaults and mutation refresh remain unchanged. This is an additional required dataset, not a latency claim or a claim that every client read disappeared. Existing catalog helpers retain known-key/first-matching semantics; arbitrary unsupported saved relief keys remain a pre-existing limitation. The editor callback file is unchanged.

Final focused verification passed three files / 77 tests, including the unchanged editor callback suite and query-refresh controls. Final TypeScript and scoped ESLint both exited zero. The new actual-hook cases cover delayed reads, failed-only retry, stale-data read errors, confirmed empty data, non-resident failure independence, canceled/failed/successful draft saves and late completion after unmount and cache clear. Full gates, independent review and corrected actual Next qualification remain pending; no implementation PR or shipment is claimed.

Full isolated product gates passed: check, test:ci and build each exited zero. Vitest passed 144 files / 1,453 tests with statements 93.18%, branches 89.22%, functions 91.70% and lines 93.89%; existing security floors were unchanged and passed. Next.js 16.3.8 Turbopack compiled and generated all 17 pages. Logs: `122-full-check.log`, `122-full-test-ci.log`, `122-full-build.log`; exits: `122-full-gate-exits.json`. The independent six-path review passed against the source freeze. Corrected actual Next browser qualification and normal-hook delivery remain pending; these product gates are not evidence of live authentication, private records or production behavior.

Corrected actual Next browser qualification passed on the exact three salary source bytes copied into the separately reviewed synthetic memory fixture. Dashboard and salary details both showed projected tax 1,033 with saved SRS 100. In the actual Reliefs dialog, changing SRS to 200 and Confirm saved and automatically closed; details refreshed to tax 1,026 and client navigation back to Dashboard showed 1,026. The external webpack build exited zero; evidence is retained in `122-next-corrected-browser-proof.md`. Fixed-memory identity/vault/action adapters do not prove production authentication, database durability or real financial records. Cancel/failure/readiness behavior remains qualified by actual-hook regressions rather than additional browser claims. Root accepted this bounded proof, independent source review and full gates for normal-hook delivery; shipment remains unclaimed until exact-head green merge.
