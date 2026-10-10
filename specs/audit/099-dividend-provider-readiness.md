---
id: '099'
area: audit
status: owner-authorized
created: 2026-10-10
author: Codex
constitution_satisfies: ['§2.1', '§2.3', '§3.2', '§4.2', '§4.4', '§7.4', '§8.2']
---

# Distinguish unavailable dividend feeds from usable empty results

## Owner-authorized scope and evidence before implementation

Clarence's continued ordinary audit/remediation and parallel-worktree request authorize this batch under§7.4. Root's2026-10-10 independent review of099 external SCOPE/RESULTS and actual action/scanner source found the bounded fix high confidence, then authorized implementation after097 merged. Base13dd5b5681fe8beca6a6526e929c69fc7bb647f5. No new dependency, provider/source/license, feature, migration, math/schema, crypto or protected-file change. No private account, env, PIN, cookie, vault record or live-provider access.

fetchDividends returns[] for HTTP/nonJSON/whole-schema/network failure. Scanner cannot distinguish this from usable empty feed. Independently, an explicitly rejected action catches to a toast then renders 'No new distributions found'/'everything is already recorded'. Exactly two product consumers: dividend-scan-dialog workers and DividendFormDialog.handleSuggest; both already catch rejected actions and author fixed client messages.098 owns form editor lifetime and does not change array/exception contracts;099 must not edit that component.

External actual-action/mock-fetch and mounted-scanner/mock-action tests against unchanged097 source prove six behavior failures and one true-empty control pass. No imports/helper failures. Additional qualified-empty copy case drafted. Evidence visualroot/099-lab/SCOPE.md, RESULTS.md, baseline.log; synthetic fixtures only.

## Affected paths and changes

src/features/equity/actions/price-actions.ts; src/features/equity/components/dividend-scan-dialog.tsx; test/features/equity/price-actions.test.ts; new test/features/equity/dividend-provider-readiness.test.ts and dividend-scan-readiness.test.tsx; this audit and README durable provider-readiness clarification. No form/hooks/query-key/feed/math/schema changes.

Keep successful array of validated ex-date/DPU points, current invalid-ticker/no-request return and tested individual-invalid-point filtering. Fail whole-provider HTTP, JSON parsing, response-shape and network/timeout errors with fixed opaque AppError EXTERNAL_API; requireUserId remains outside provider catch so unauthorized contract is retained. Visible client behavior never inspects transported exception code/message and remains safe under production redaction.

Scanner separates pending, failed and successfully empty/candidate states. On any ticker failure, publish no partial candidates/import controls; show visible opaque retry while preserving existing concurrency/cancel/unmount lifecycle. Retry clears error/rows and scans again. Qualify actual empty result to eligible estimates in returned data; no statement that all received payments are recorded. Existing review/date/source assumptions remain visible. Reuse existing Button and semantic tokens rather than add a page/modal/primitives.

## Acceptance, independent review and rollback

Meaningful real-action/provider tests fail baseline for HTTP503, nonJSON, invalid whole response and network throw; usable no-events response remains[] and existing individual-point/invalid-ticker tests continue. Mounted actual scanner fails baseline for rejected action/partial failed scan/overstated empty copy; retry restores reviewable candidates, no partial writes, canceled old attempts cannot publish/toast.098 manual Suggest exception path remains unchanged.

Synthetic tracked fixture only for check/test:ci/build, each aggregate>80% and stricter floors unchanged. Independent root review and bounded actual-component synthetic desktop/mobile proof before normal hooks/commit/PR. README/comments reflect final behavior. Rollback scoped code revert with no data reversal. No live-provider completeness, authentication, licensing, measured-latency or recovery claim.

## Guidance

[MDN fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) distinguishes HTTP status from fetch rejection; JSON parsing can reject. [Next expected errors](https://nextjs.org/docs/app/getting-started/error-handling) generally recommends modeled expected-error return values. This bounded compatibility remediation deliberately keeps two existing exception/catch consumers instead of inventing a result union; it does not claim Next recommends throwing expected provider errors. AppError's safe fixed message contains no provider/ticker/private details; client feedback is authored locally regardless of exception redaction.

Impeccable harden/craft-floor applied within the incumbent Operate UI: essential error/retry/assumptions visible, no tooltip concealment or speculative interface. Project next-verify supplies five gates. No skill installation/harness edit; unavailable catalog skills not claimed invoked.

## Results

Latest-main mounted baseline: seven expected behavior failures and one genuine no-events control pass (099-red-baseline.log). Corrected four-file provider/scanner/incumbent suite86 tests passed (099-focused.log); typecheck passed (099-typecheck.log). An initial format invocation passed the PowerShell array as one combined path; explicit paths corrected it before final source review. Independent read-only review found no executable blocker: opaque whole-response failures, auth-first contract, current invalid-ticker/point filtering, no partial ticker results and guarded retry remain compatible with098 form catches. README and action comment document only durable provider/readiness contracts. Impeccable detector returned no findings. Individual-invalid-point filtering and schema-valid absent events remain deliberate current source limitations; a usable empty result is not verified source/payment completeness. Final pnpm check, pnpm test:ci and pnpm build passed (099-gates.log):126 files/1072 tests; statements93.45%, branches88.89%, functions91.02%, lines93.74%; stricter floors unchanged. Root fresh source review likewise found no blocker. Actual-component synthetic browser proof passed visible initial error, real Retry-to-DBS100shares/SGD20 estimate, no partial table on mixed ticker failure, qualified usable-empty copy, and390px mobile width with no overflow. Evidence099-provider-desktop-proof.jpg/099-provider-mobile-proof.jpg in visualroot. Browser adapters mock provider reads and reject imports; proof does not exercise actual Next Server Function transport/redaction, authentication, live feed or completeness. Preview tab/server were closed. Existing provider fetch cache/revalidation policy is unchanged; Retry does not promise a forced fresh provider response. Source frozen for unchanged-hook delivery; not shipped until parent PR and exact-head green-CI merge.
