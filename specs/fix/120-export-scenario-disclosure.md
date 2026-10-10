---
id: 120
slug: export-scenario-disclosure
area: fix
status: draft
author: Codex
created: 2026-10-11
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§1.1'
  - '§2.1'
  - '§2.5'
  - '§3.2'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§5.1'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Spec 120: Disclose saved scenarios in personal export

## Problem

The Profile export card lists eight personal domains and omits saved planning scenarios, although the current version 3 download includes complete scenario records as its ninth domain. Users reviewing what leaves their vault could reasonably believe their saved hypothetical plans are excluded. The actual export is complete; its visible disclosure is incomplete.

## Constitution check

- Satisfies `§1.1`, `§2.1`, `§2.5`, `§3.2`, `§4.1`, `§4.2`, `§4.4`, `§5.1`, `§7.4` and `§8.2`.
- Overrides: none. Existing encryption, identity/vault guards, export payload/version and household separation are preserved. The existing interactive client component remains; no new client boundary is introduced.
- This is an ordinary reversible disclosure remediation under Clarence's owner-authorized audit and stabilization scope, selected by root on 2026-10-11 after reviewing external finding SHA `97957e0c7bb86b8143cffbe8b7f08986622169a6e737c978daa52410c16f2116`. It is not agent approval of a new feature. Keep `status: draft` and `approved` blank; publish this scoped record before implementation under `§7.4`.
- No dependency, schema/data migration, crypto protocol, deployment or protected-file amendment is proposed. No real environment, credentials, cookies, vault secrets or confidential records are needed.

## Solution shape

Initial three-path remediation scope (the pre-recorded linked closeout below makes five final delivery paths):

| Path                                                   | Change                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `src/features/profile/components/export-data-card.tsx` | Add saved planning scenarios to the existing CardDescription domain list.                                       |
| `test/features/profile/use-export-data.test.tsx`       | Extend the existing mounted-card disclosure regression with visible scenario inclusion and household exclusion. |
| `specs/fix/120-export-scenario-disclosure.md`          | Record scope, authorization, evidence, checks, independent review, results and delivery.                        |

Use the concise phrase: “tax reliefs, trades, dividends, planner settings, and saved planning scenarios.” Keep the existing statements that the server decrypts during an unlocked session, the file contains plaintext, household data is excluded, restore is unavailable and concurrent edits can appear inconsistently. Essential confidentiality and export limitations remain visible beside the existing button; no accordion, tooltip, modal or extra feature is needed.

Evidence inspected:

- `src/app/dashboard/profile/page.tsx:15` mounts the actual card.
- `src/features/profile/components/export-data-card.tsx:22` starts the eight-domain list.
- `src/features/profile/hooks/use-export-data.ts:75` reads `getScenarios()`; `:89` includes those records in the envelope.
- `src/features/profile/lib/export-data.ts:27` declares `scenarios: ScenarioRecord[]`; `EXPORT_VERSION` is 3.
- Existing serializer and hook tests cover nine-domain version 3 data, saved scenarios, failed reads and download/lifetime cleanup. Retain those tests rather than duplicating serializer assertions for a copy fix.
- README's Personal data export and Private saved planning scenarios sections already disclose the ninth domain correctly. Review them and retain them unchanged; no fourth README path is justified. The card has no stale explanatory comments needing a new comment or cleanup.

Impeccable's existing-surface clarify guidance was read: preserve factual product terminology, name the consequence before export, say each qualification once and keep privacy consequences visible. Its context tool permits this narrow refinement against the incumbent component without creating PRODUCT.md or redesigning the surface. At the external proposal freeze no UI edit had occurred. Root deemed a detector unnecessary for this plain copy correction; no detector, dependency/plugin update or new design file was run.

Data model changes: none. Public component/hook/action interfaces: unchanged. Encryption-touching implementation paths: none; the current hook still performs the same guarded/decrypted reads and plaintext download.

## Out of scope

- Export serialization, version, nine-domain payload, snapshot metadata projection or scenario revision/creation-request identity changes.
- Export restore, encrypted download, coherent snapshot/backup, recovery or exactly-once promises.
- New actions, provider calls, authentication/vault/RLS/encryption or household behavior.
- Layout, design system, new help affordances, README rewrites or unrelated comment cleanup.
- Product or fixture build/server work before the selected sequential delivery and shared-heavy-slot handoff.

## Acceptance

- [x] Scoped record exists before editing the card or test; only the five final delivery paths change.
- [x] Add a visible `/saved planning scenarios/` assertion to `explains material export limitations beside the existing action` in the existing test file. Against shipped source this assertion fails meaningfully; no new-module import or missing mock is counted as baseline failure.
- [x] Corrected mounted test passes and explicitly retains visible plaintext, household exclusion, non-restorable and concurrent-edit qualifications plus the existing enabled export button expectation.
- [x] Existing hook/serializer tests remain unchanged and green. No coverage threshold is lowered; every aggregate metric remains above 80% and all existing security floors pass.
- [x] `pnpm format:check`, `pnpm lint` and `pnpm typecheck` pass (`pnpm check`).
- [x] `pnpm test:ci` and `pnpm build` pass; use only the isolated synthetic fixture and normal unchanged hooks.
- [x] A fresh independent review confirms wording matches actual version 3 behavior and the five-path delivery diff preserves existing confidentiality qualifications.
- [x] Manual source review confirms README is already correct and the card retains its existing visual structure. No standalone browser build is required for this text addition. The pending shared actual Next fixture may verify it after the final merged stabilization fix; generated downloads remain bounded synthetic evidence, not recovery proof.
- [ ] Record exact scoped hashes and baseline/final evidence. Link the owner-authorized audit record in the implementation PR; no approved-spec hash or owner approval is invented. Root reviews exact-head CI before merge. Mark shipped only after verified merge.

## Risk & reversibility

- **Blast radius:** one Profile-page description and its regression. It changes which existing exported data users are explicitly told about. Payload, download action, timing, rendering controls and persistence are unaffected.
- **Reversibility:** an ordinary code/test Git revert; no migration or data reversal.
- **Backout plan:** revert the implementation through unchanged hooks if the disclosure is inaccurate or a verification failure reveals unintended scope. Preserve the audit and its historical evidence; do not remove the already-correct README/scenario-export contract.
- **Residual limits:** the export is plaintext and non-restorable, and independent reads can observe concurrent changes. This copy correction does not prove production auth, atomic reads, cryptography, backup fidelity or disaster recovery.

## Open questions

- [x] Scope and copy approach — Owner: root under the standing owner audit. Resolution: the exact three-path ordinary remediation was selected; no README edit because it already lists scenarios.
- [x] Extra browser build — Owner: root. Resolution: unnecessary for this text-only disclosure; the pending shared final fixture uses the last merged stabilization source.
- [x] Implementation timing — Owner: root. Resolution: bounded preparation and focused proof preceded delivery; root verified 117 merge and released exact merged integration/fixture ownership before the five-path freeze. Full gates follow root and independent review.

## Results

At the initial external-draft freeze, only read-only source/consumer/test/README inspection had completed and root selected this batch. The subsequent preparation and bounded proof are recorded below; verified parent integration and final gates have now completed; normal hooks and exact-head PR delivery remain pending.

## Parallel preparation timing refinement

Root selected bounded lightweight preparation on 2026-10-11 while 117 is locally green/frozen but unmerged and still owns the fixture/heavy slot. The clean attached managed latency worktree was verified and a new `impl/120-export-scenario-disclosure` branch was created from merged119 commit `496f637d3e4f19069b6a53183131242683449973`, preserving the 119 branch and all stashes/history. This record is published before test edits. Only the existing rendered-card test gains visible scenario/household assertions during preparation; the product card remains byte-identical until a meaningful baseline runs after fixture ownership release. No test, gate, hook, commit, build or server is authorized during 117 push. Before 120 delivery, integrate the verified 117 merge and use the released existing corrected synthetic fixture; no extra dependency materialization. The earlier implementation-timing open item is resolved for this preparation only and remains pending for baseline/card correction/gates/delivery. Root confirmed an optional detector is unnecessary for this plain disclosure; it must not expand paths/tools.

Pre-edit card/test bytes and accepted external draft SHA `00767bcc2ca0f5f707d45e6c9999c2fd21dd2a8d50952f56de4379091f84c7f1` are preserved in external `120-preparation-provenance`. No README, export hook/serializer or other product path is touched.

## Bounded baseline evidence

After root released the existing 117 synthetic fixture following normal push-hook completion, copied only the two prepared assertions into its existing export hook/card test. Parent 117 basis 7b7a4769ed5bf1477b9e0f4f8abe61254aee6ec6 remained explicitly UNMERGED. Preserved target card/test bytes, absent 120-spec status and prior 14-path manifest first. The single existing test file produced one meaningful RED for missing visible saved planning scenarios and 16 passing controls (17 total). Product card remained unchanged SHA dd015b1afa9303467f3c4d0da9e820c6fa22c1c8a1359e120597165b7ac570d5. No card correction, full gates, hooks, build, server or commit occurred. Exact baseline log: external 120-unmerged117-baseline-red.log. Root reviews this baseline before the copy change, and verified 117 integration is still required for final delivery.

## Linked 117 closeout scope — before metadata edits

Root recorded `120-linked-117-closeout-scope.md` before selecting these two ordinary linked delivery-record paths under the owner audit. The complete delivery inventory is now exactly five paths:

1. `src/features/profile/components/export-data-card.tsx` — existing description disclosure only.
2. `test/features/profile/use-export-data.test.tsx` — two existing mounted-card assertions only.
3. `specs/fix/120-export-scenario-disclosure.md` — this owner-authorized scope/results record.
4. `specs/fix/117-expense-salary-field-labels.md` — shipped frontmatter and verified delivery evidence only after root confirms PR41 merge/CI/public deployment facts; retain historical failure evidence and limits.
5. `docs/audit/2026-10-09-roadmap-progress.md` — verified 117 delivery and scoped 120 preparation/results only; retain history and outstanding decisions.

The earlier three-path table remains the original executable/test/audit scope. These two added paths are linked ordinary metadata closeout only, not feature or product scope expansion. PR41 head `7b7a4769ed5bf1477b9e0f4f8abe61254aee6ec6` is locally green and published but remains unmerged at this scope publication. Do not edit the two metadata paths or claim shipment until root supplies independently verified facts. Full 120 gates/delivery still wait verified 117 integration. No README/protected/schema/crypto/dependency changes or whole-roadmap completion claim.

Root accepted the meaningful one-failure/16-control baseline and authorized the already recorded exact card phrase correction and focused proof now; no full gates or commit during the pending 117 integration.

## Bounded corrected proof

After root accepted the missing-disclosure baseline, applied only the existing card phrase correction and retained all material export qualifications. The same existing mounted export test file passed all 17 tests; new assertions verify visible saved planning scenarios and household exclusion. Scoped generated formatting, two-file ESLint and TypeScript all passed. Logs: external 120-focused-green.log, 120-focused-format.log, 120-focused-lint.log and 120-focused-types.log. This used the released synthetic fixture based on published but unmerged 117; no full gates, hooks, build, server, commit, metadata closeout or shipment occurred. Root-verified 117 merge integration and the complete five-path freeze remain required before final gates/delivery.

## Verified parent integration and five-path freeze preparation

Root verified 117 PR41 merge de63922bb62c0b55e36625a66db508832a61671f and public deployment SUCCESS. Preserved only the three existing 120 preparation paths in retained stash 89e2bdb9fa01b00723c7d9a91a45573cffb06fc2, normally fast-forwarded from 496f637 to exact 117 merged main, and applied the retained stash without conflict or deletion. Card/test bytes still match corrected focused proof. Published parent head 7b7a4769 and merged de63922 have identical tracked trees; the physical released 117 fixture already contains this ordinary merged-source tree. Only exact five 120 paths are synchronized for final gates; no additional dependency copy, protected edit or runtime change. Linked 117 audit/progress now record verified shipment/public status while retaining historical evidence. Source freeze/root and independent review precede full gates, unchanged normal hooks and exact-head delivery.

## Final verification and second review

Root's five-path diff review and the fresh independent read-only review passed against merged parent `de63922bb62c0b55e36625a66db508832a61671f`. Independent review verified all five hashes against freeze manifest SHA `3c17ff664ce8a701219307f67c10f3a562192a702a5479734dd6d817cae55051`, disclosure accuracy, retained warnings, test scope and factual linked 117 metadata. No scoped blocker remained; the reviewer ran no gates or edits.

The unchanged full pipeline `pnpm check`, `pnpm test:ci`, `pnpm build` exited 0 in the isolated synthetic fixture. Route logging, full formatting, lint, TypeScript, all 144 test files / 1,445 tests, coverage and production build passed. Aggregate coverage: statements 93.10%, branches 89.11%, functions 91.49%, lines 93.81%; all existing stricter floors were retained and passed. External logs: `120-final-check.log`, `120-final-test-ci.log`, `120-final-build.log`. Existing physical pinned dependencies and normal config/hooks were reused; no real environment or private account data was read. No application change followed the frozen reviews. Normal commit/push hooks and exact-head CI remain required; this batch is not marked shipped before root verifies merge. Browser verification of the final integrated fixture remains separate and does not change the disclosure-copy acceptance.
