---
id: '092'
area: audit
status: owner-authorized
created: 2026-10-10
author: Codex
constitution_satisfies: ['§2.1', '§3.1', '§4.1', '§4.2', '§4.4', '§7.4', '§8.2']
---

# Personal export qualification and resource cleanup

## Authorization and evidence

Clarence's sequential roadmap and parallel-worktree direction authorize ordinary remediation under §7.4; root explicitly selected spec091 part A only. Baseline merged main96eab4. Existing plaintext export is not an atomic backup or a restore mechanism; Profile copy explains plaintext and household exclusion but omits these material limitations. Browser download exceptions skip anchor/object-URL cleanup. The asynchronous hook relies on rendered disabled state instead of a synchronous in-flight guard; add a guard only after baseline overlap reproduction.

## Recorded scope before edits

Paths: src/features/profile/hooks/use-export-data.ts; src/features/profile/components/export-data-card.tsx; test/features/profile/use-export-data.test.tsx; README.md; this record. Preserve version2 shape, current domain readers and filename. No restore, RPC, dependency, migration, crypto, protected edit or new feature. Spec091 remains draft and is not authorized by this record.

Add visible concise no-restore/concurrent-edit qualification. Test nonempty eight-domain roundtrip, empty export, each domain rejecting without partial download, pending unmount on success/failure, same-tick concurrent invocation and failed download resource cleanup/retry. Keep existing pagination/history proofs; these do not establish coherent snapshots. Use finally cleanup for temporary resources and synchronous in-flight guard if reproduction confirms duplication. Errors remain opaque; no file contents/private data logged. Update README/comments for resulting behavior.

## Acceptance and rollback

Prove cleanup/overlap regressions fail baseline before source fixes. All five gates in independently installed085 synthetic fixture with tracked-only synchronization and known inline placeholders; every aggregate coverage metric above80% and stricter floors retained. Independent second review and synthetic browser copy/download proof coordinated with root. Rollback is scoped git revert, no stored data mutation. No committed/merged/shipped claim until actual delivery.

## Guidance

Impeccable harden/craft-floor in Operate mode: material export limitations visible beside existing button; no extra surface or fine-grain control. Its context script remains skipped under the established owner privacy constraint because earlier inspection found unrelated credential/cache discovery. Existing next-verify skill defines gates. TemplateCentral/frontend-design are unavailable in catalog; no invocation or installation claimed.

## Results

Baseline synthetic regressions failed for both same-tick overlap (two reads instead of one) and click exception cleanup (object URL not released), then passed after scoped fixes. Focused20 tests passed. All five isolated quality gates passed:118 files/944 tests; statements92.84%, branches87.90%, functions90.34%, lines93.14%; strict floors unchanged; Next16.3.8 optimized build passed. External logs092-baseline-proof.log,092-focused.log and092-gates.log retain evidence.

Independent second source review found no blocking finding. VaultGate replaces protected children when locked; signout/idle lock trigger that context, so late resolved/rejected unmount tests match the actual protected subtree lifecycle. Root verified the actual browser-downloaded JSON contains all eight nonempty synthetic domains, failed dividends show an opaque retryable error, and desktop/mobile390px layouts have no overflow. Artifacts092-export-desktop-proof.jpg and092-export-mobile-proof.jpg record the UI. Preview used actual card/hook/native download with synthetic read adapters only, no auth or persistence; browser download-event waiting stalled but the generated synthetic file was independently inspected, so no second event-wait claim is made. Temporary browser tab closed, viewport reset and preview server stopped. This proves the frontend download path, not coherent DB recovery.

Atomic point-in-time export and transactional restore remain draft proposals in091. Unchanged pagination can miss equal-count concurrent replacements; the visible export qualification and README do not claim recovery or database snapshot consistency. No live account, confidential file or secret was read, and this batch does not claim exhaustive security verification.
