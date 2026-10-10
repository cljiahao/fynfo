---
id: 102
slug: monthly-review-contributing-records
area: feature
status: shipped
author: Codex
created: 2026-10-10
approved:
shipped: 2026-10-10
impl_pr: https://github.com/cljiahao/fynfo/pull/30
supersedes:
constitution_satisfies:
  - '§2.4'
  - '§2.5'
  - '§2.6'
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Spec102: Explain monthly review using contributing records

## Problem

Monthly review shows recorded income, personal spending and asset change, but owners must leave the page and manually reconstruct which records contributed. Availability guidance from100 does not explain salary/bonus components, deductions for shared expenses or the two snapshot values behind an asset change.

## Authority and constitution check

Implementation is within Clarence's approved081 sequential roadmap direction, itemV, and explicit owner authorization to deliver ordinary features one coherent batch at a time. Root selected this bounded existing-data increment on2026-10-10; this records the scope rather than claiming separate owner approval of every finding. Start implementation only after100 is merged and a fresh branch is based on current main. Satisfies cited sections through existing owner/vault reads, no secret exposure, feature-owned derivation, durable concise UI and meaningful regression proof. No overrides or protected edits.

## Solution shape

- Extend existing `buildMonthlyReview` with the selected source projection used by its aggregate totals, rather than computing a second set of rounding/split formulas. Expose selected income salary/bonus components, each expense's gross amount, aggregate other shares and own share; invalid per-record split yields null own share and the existing aggregate remains null. Existing aggregate numeric/missing/readiness contracts stay unchanged.
- Expose exact selected/previous calendar-month snapshot totals or null. Use the same values to derive existing assetChange. Do not fabricate transaction flow or market-return explanations.
- Add a feature-owned contributing-records view within existing Sources and next steps disclosure. Basic metrics, errors and material assumptions remain visible when collapsed. No split-person names, unnecessary expense info or new private-data sinks.
- Show at most20 expense rows, actual full matching count and existing full-history total. Page changes affect rendering only. Reset month pagination and clamp display after records shrink. Long item labels wrap; genuine zeros differ from missing sources. Source links retain existing supported feature destinations, without invented expense deep links.
- Reuse PaginationControls. Existing control hardcodes10/25/50; proposed backwards-compatible optional pageSizes with unchanged default and review-only[20] was confirmed by root for this ordinary reusable widget extension. No new primitive or dependency.
- Existing MonthlyReview already uses snapshots/salary/expenses hooks; no additional query, history, server action or API.

Proposed exact paths (record before edits):

- `src/features/review/lib/monthly-review.ts`
- `src/features/review/components/monthly-review.tsx`
- `src/features/review/components/monthly-review-sources.tsx` (small feature-owned presentation, if separation keeps parent readable)
- `src/features/review/constants.ts` (fixed page size/options)
- `src/components/widgets/pagination-controls.tsx` (optional constrained sizes, root confirmed scope)
- `test/features/review/monthly-review.test.tsx`
- `test/features/assets/monthly-review.test.ts`
- `test/components/widgets/pagination-controls.test.tsx` (new meaningful mounted default/constrained option regressions)
- `README.md`
- `specs/feature/102-monthly-review-contributing-records.md`

Data model, public action and encryption contracts: unchanged. New component receives computed review sources only and owns display pagination; no own fetch. Existing client boundary is required for current query/disclosure/pagination behavior, no unnecessary page-level fetching.

## Out of scope

Certified closing, reconciliation, statement matching, full timeline/global search, portfolio valuation, conversion, account flows, edit-history metadata, separate source histories, new persistence, schema/RPC/migrations, crypto, dependencies, protected governance/tooling changes and guarantees that visible page sums equal full-history totals.

## Acceptance

- Meaningful actual-mounted regressions fail before implementation on absent contributing rows; pure projection tests verify totals and corresponding sources share the same values.
- Salary and bonus sum with existing per-component minor-unit rounding; recorded zero stays available, missing month stays missing.
- Shared gross/others/personal breakdown includes settled and unsettled other shares; a single invalid split has null personal row and null aggregate, without showing person's name.
- Exact current/previous snapshot values and January previous-year month; missing current/previous does not turn into zero change. Existing arithmetic is unchanged.
  -21+ expense records show at most20 initially; page2 shows remaining rows while full count and total remain unchanged; month switch resets page and cached-history query read counts remain one per domain.
- Pending/error states cannot show qualified source rows; failed-only retry behavior retained. New source rows reflect mutations without retaining old month/owner data.
- Existing default PaginationControls sizes unchanged; constrained review sizes do not permit25/50 and omit the redundant singleton selector. Keyboard controls/disclosure work, semantic labels are readable, long strings wrap and390px synthetic preview has no overflow.
- `pnpm check`, `pnpm test:ci`, `pnpm build` green in isolated synthetic fixture; each aggregate coverage metric stays above80% and strict security floors unchanged. Record baseline/fullgate results and fresh independent review before PR.
- README/comments reviewed per batch. No short-lived narration or commented code added. Spec owner scope linked in PR, shipped metadata only after merge.

## Risk and reversibility

Blast radius is monthly-review derivation/display and a backwards-compatible optional pagination presentation input. A source projection error could misstate personal totals; tests assert existing aggregate contracts and derive aggregate from the same selected rows. Review does not change records or authorize reconciliation. Revert the scoped commit to restore existing display; no database rollback or data migration required.

## Open questions

- Resolved by root: optional readonly pageSizes input preserves default10/25/50; review passes[20].
- No unresolved implementation question; source edits wait for100 merge confirmation and fresh branch. Exact pure and new widget test paths are recorded above.

## Results

Baseline proof: three new regressions fail against merged100 source, while11 existing cases pass (102-baseline.log). Implementation branch starts from main03de9f96ed740907d2ef07ea53b5b414de3ce649 after100 merged. Qualification completed below.

Skill guidance: Impeccable clarify/craft-floor preserves the incumbent Operate interface, essential assumptions and semantic disclosure. Existing Fynfo barrel and data-layer patterns are retained. TemplateCentral/frontend-design were unavailable in this runtime; no invocation, installation or protected skill-file edit is claimed.

### Completed qualification

- Baseline: three new projection/mounted regressions failed against merged100;11 existing cases passed (`102-baseline.log`). Final focused19 tests/3files and typecheck pass (`102-focused.log`, `102-typecheck.log`). Includes shared-only invalid qualification preserving legacy self-negative arithmetic, unnamed-item fallback, same-cache month reset, source shrink clamp and default/constrained pagination options.
- Full five gates pass in isolated synthetic fixture (`102-gates.log`):129 files/1104 tests; statements93.50%, branches89.22%, functions91.08%, lines93.79%. Original stricter security floors retained; optimized Next16.3.8 build passes. No hooks, test timeouts, workers or floors changed.
- Root and independent reviewer both found no scoped blocker after corrections. No split-person name is projected; existing aggregate arithmetic and query lifetime are preserved.
- Root browser qualified actual feature/projection/hooks against synthetic readers:20rows then Enter on Next shows21st of21; full income5200, personal spending1576.05 and asset change2000 remain unchanged. Shared expense100.10 minus other25.05 equals75.05; invalid other101 yields Check shared splits in row and visible top metric. Long unbroken item wraps at390px with scrollWidth375 and no overflow. Desktop/mobile artifacts: `102-sources-desktop-proof.jpg`, `102-sources-mobile-proof.jpg` in the external visualroot.
- Fail-once salary read showed opaque error and Retry; actual retry restored salary5000+bonus200, expense75.05 and snapshots8000/6000. Root closed browser tab/reset viewport; preview74600 stopped.
- Native browser month driver could change the displayed input without committing React's selected period; browser month-reset qualification is not claimed. Actual-mounted tests prove committed month changes reset pagination with no extra source reads. No product defect is inferred from that driver limitation.

### Limits

The proof uses fixed synthetic records, not production auth/vault/DB transport or private financial records. This increment explains existing monthly-review totals only; broader V portfolio/tax explanations, ACtimeline, ADsearch and certified monthly closing remain separate scope. Existing legacy nonfinite/negative-value aggregate readiness contracts are unchanged. No performance gain, statement match or full audit-history claim is made.
