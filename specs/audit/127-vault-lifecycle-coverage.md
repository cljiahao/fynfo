---
id: 127
slug: vault-lifecycle-coverage
area: fix
status: draft
author: Codex
created: 2026-10-11
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.3'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§5.1'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Audit127: Cover the existing vault lifecycle boundary

## Problem

The passing 125 normal pre-push coverage report leaves `src/app/api/vault/route.ts` at statements 79.34%, branches 77.08%, functions 71.42% and lines 80%. Its existing test file exercises GET/POST but never DELETE, and the route has no targeted coverage floor. This is a concrete test-assurance gap in a security-critical boundary, not evidence of an exploitable product defect or a reason to claim that global coverage proves every sensitive path.

## Constitution check

Root selected this exact ordinary test/config remediation under Clarence's audit authorization (§7.4) on 2026-10-11. Publish the scope before implementation; approved remains blank. The existing identity, encryption, rate-limit, canary and cookie protocols (§§2.1,2.3,5.1) remain unchanged. Preserve §8.2 restrictions, normal hooks and all required gates. No new dependency, migration, production code, protected-file amendment or real account/secret access is included.

This preparation writes only the audit.126 currently owns normal-hook verification and121 closeout has priority afterward. No tests/config implementation or verification job may begin until root releases and reviews this scope. Governance126 is separate.

## Solution shape

Exactly three prospective ordinary tracked paths:

1. `specs/audit/127-vault-lifecycle-coverage.md`: scope, source-backed cases, baseline, verification, independent review and residual limits.
2. `test/api/vault.test.ts`: extend the existing actual-route suite using owned synthetic fixtures and inert auth/database/cookie/RPC spies. Retain all GET/POST/concurrent-initialization controls; no replacement production implementation or real transport.
3. `vitest.config.ts`: add an exact `src/app/api/vault/route.ts` floor of at least 81 for statements, branches, functions and lines. Retain every existing stricter floor, aggregate 81 targets, coverage inclusion/reporting/exclusions and worker configuration. Do not exclude uncovered paths, lower thresholds or change execution defaults.

Production route is inspection-only. Source-backed test contracts:

- Authenticated DELETE success: call the actual exported route; verify exactly the existing `users_profile` reset payload `{ vault_check_v2: null, vault_version: 1 }`, owner-ID predicate and successful response. Delete only the existing personal DEK cookie after successful write; no new cookie is set, encryption/reservation/initialization work is not invoked. This is mock boundary proof, not actual database durability or key recovery.
- DELETE missing user and auth-error cases: opaque 401, no database mutation, no cookie set/delete. A provider-private error must not appear in the response. Verify database access is skipped at this boundary rather than merely returning an error.
- DELETE returned write error: opaque 500, no cookie set/delete, no success field. The authorized owner-scoped write was attempted; do not falsely assert zero database work for this case. Capture provider details only in synthetic inert spies, not real logs/credentials.
- POST canary plaintext mismatch with a successfully authenticated/decrypted generated envelope: include unequal-length and equal-length wrong plaintext if needed to exercise both existing constant-time comparison branches. Existing wrong-key/decryption-error cases remain. Verify rejected outcome, failure finalization and no cookie set or profile reinitialization; do not label a mock exception as a new production bug.
- POST invalid exactly 44-character base64 inputs: prove boundary rejects canonical-length strings decoding to an incorrect byte length and/or failing round-trip canonical encoding before canary write or cookie set. The existing protocol is 44 encoded characters for 32 decoded bytes, not a 44-byte DEK. Preserve already-covered missing/short/noncanonical inputs and do not fake an unreachable Buffer exception just to inflate coverage.
- POST finalization error after valid canary: actual security-RPC wrapper fails closed with opaque 500 and no cookie set. Keep the existing reservation/verification sequence, assert correct successful-finalization attempt, and no profile initialization for a returning vault. Include failure-finalization error only where source evidence and meaningful fixtures justify it.

Extend the existing synthetic cookie jar with a delete spy and the inert query builder with the actual DELETE awaited `update(...).eq(...)` response shape without breaking POST's `.is(...)` conditional initialization. Assert calls/predicates and response opacity, not just status or line execution. Fixture setup/cleanup must isolate cookie/profile/RPC state and restore synthetic environment stubs. No secret environment files are read or copied.

README and inline comments are reviewed against the resulting test/config contract. Existing public vault behavior and deployment instructions are unchanged, so no README path is selected. Retain tooling directives and meaningful concurrent-initialization rationale; avoid narrated test comments or unnecessary abstractions. No UI or new feature is introduced.

## Out of scope

Production vault/DELETE behavior changes, auth/RLS/CSRF policy, reset semantics, canary or crypto protocol, cookie lifecycle changes, rate-limit design, historical data restoration, dependencies, schema/SQL, real Supabase/provider/cookie/PIN/credential inputs, protected hooks/CI and broader coverage cleanup. Unreachable source branches are reported honestly, not reached through artificial production edits or coverage exclusions. No exhaustive security or recovery guarantee.

## Acceptance

- [x] Record the exact three prospective paths before implementation; baseline is the retained125 report and source inspection, not a newly reproduced exploit.
- [ ] Execute meaningful actual-route synthetic DELETE success/auth/write-error cases with owner predicate, opaque responses and appropriate no-cookie/no-database controls.
- [ ] Fill source-backed POST canonical-length/mismatch/finalization gaps while retaining all existing lifecycle and concurrent controls; new cases prove outcomes and forbidden effects.
- [ ] Exact route coverage reaches at least 81% in each metric, enforced by its new targeted floor. All aggregate metrics remain above 80%, existing stricter floors unchanged. Preserve workers, reporting and exclusions.
- [ ] All required format/lint/types/tests/build gates and unchanged normal hooks pass under root-coordinated timing. No duplicate heavy job or bypass.
- [ ] Fresh independent review verifies production source unchanged, exact three-path scope, meaningful cases, mock fidelity and coverage floor; root checks exact-head green CI before merge.
- [ ] Record remaining untested/unreachable conditions and limits explicitly.121 may record this pending assurance gap; neither this draft nor a passing mock suite proves production auth/RLS, provider behavior or complete cryptographic correctness.

## Risk & reversibility

- Blast radius: tests and coverage enforcement only. A misleading mock could provide false assurance; a legitimate uncovered condition could make gates fail rather than warrant a lower threshold.
- Reversibility: ordinary scoped Git revert of test/config/audit changes; production behavior and persisted data are unchanged.
- Backout plan: preserve existing tests and baseline logs, investigate new failures against actual source, and record any unsupported branch. Never alter production protocols or weaken exclusions/floors to make this batch green.

## Open questions

- [ ] Root releases implementation/verification after126 and121 priorities — Owner: root.
- [ ] Final exact-source coverage and remaining unreachable branches — Owner: implementer/reviewer, after source-backed tests; no premature complete-security claim.

## Results

Preparation only. Source inspection confirms actual exported DELETE is untested in the existing suite; its owner-gated update and cookie deletion paths are present. `125-normal-push.log` reports route S79.34/B77.08/F71.42/L80; global 125 coverage passed 144 files / 1,476 tests at S93.18/B89.28/F91.70/L93.89, demonstrating that aggregate success did not enforce this file's critical boundary. `vitest.config.ts` has global 81 targets and multiple stricter targeted floors, but none for this route. No tests, configuration changes, production edits, hooks or heavy jobs were run for127 preparation. No vulnerability, exploit or protocol approval is inferred.

## Selected light preparation boundary — before test/config edits

Root read and selected this exact three-path scope on 2026-10-11. The prior reviewed124 donor is retained in a path-scoped stash and its branch/history remain intact. A new `impl/127-vault-lifecycle-coverage` branch starts at verified merged125 `03dadad7b1bfd835da4b597d68a7b8997621f0f3`; this audit is copied before any test/config implementation. Preparation changes only the existing test and exact route floor. All tests, types, lint, coverage, builds and hooks wait until126 and121 delivery release the coordinated slot. Production route and protocol bytes remain unchanged. No fixture refresh, dependency copy/repair or broad source copy is performed during this preparation.

## Root review refinement — light preparation only

The reset tests now override only the terminal `update(...).eq(...)` with a plain Promise; the original POST conditional `.is(...)` builder is retained exactly. The DELETE success fixture deliberately holds the write pending, checks that neither cookie action occurs, then marks write completion and releases it before requiring deletion. This proves await ordering rather than mere predicate invocation. Invalid44-character tests assert no profile/RPC/cookie effects, not that client creation or authentication promises cannot start. Explicit plaintext length assertions distinguish equal-length wrong canary from the shorter control. Exact three-path scope and production route remain unchanged; verification is still held for121/126 priority.

## Takeover verification — 2026-10-11

Clarence transferred stabilization121/127 and the remaining roadmap to the replacement chat. The three prepared files were preserved with matching handoff hashes before fast-forwarding this worktree to merged6d172e5; the integration changed only the already-approved126 governance files and preserved every prepared byte. This supersedes the earlier scheduling hold, not the recorded scope or security limits.

Root performed a fresh source review of the prepared tests against actual vault route and security-RPC code. The terminal DELETE Promise accurately preserves the original POST conditional builder, owner predicates and await-before-cookie ordering. Canonical key and genuine synthetic encrypted-canary cases exercise meaningful existing branches; finalization errors use the actual fail-closed wrapper. Production route remains unchanged (SHA2568aa16aae8f603bce2efafbc07bf261aadf68f59b90a99d528ed31b50d9f41211). No additional path, dependency, schema or protocol is selected.

Scoped formatting, lint and diff checks passed. The actual-route synthetic suite passed29tests in1file (1.17seconds), including all retained controls and added cases. The synthetic117 fixture's ordinary verification inputs match tracked source after newline normalization except for the two intentional test/config changes, which were then copied together with this audit after preserving prior fixture inputs. No real account, secret or provider transport was used. Exact route coverage, full gates, normal hooks, final independent freeze review and delivery remain pending; this focused run does not establish production RLS, durability or complete recovery assurance.

## Final local verification and independent source review

The initial full check caught TypeScript2348 in the new fromSpy declaration: the unparameterized vi.fn return type admits a constructor. Root corrected only that existing test declaration to use typeof buildFromBuilder, preserving all fixture behavior. The failure log is retained. All29focused tests passed again; then the corrected full run passed formatting, lint, types,144files/1486tests and the production build. Aggregate coverage: statements93.52%, branches89.54%, functions91.76%, lines94.24%. Exact vault-route coverage: statements96.73%, branches95.83%, functions85.71%, lines96.66%. All new and incumbent floors passed with workers/reporting/exclusions unchanged.

Root's fresh review, independent of the original preparation author, accepted the exact three-path diff against the unchanged actual route/security-RPC code after the type correction. The stronger exact floor introduces no production behavior. Normal hooks and exact-head CI/delivery remain pending; a passing local suite is not a shipped feature.

Remaining uncovered route lines32,137,240 represent the defensive Buffer-decoding catch, the malformed-JSON fallback before schema validation, and a non-AppError canary-verification rethrow. The existing meaningful tests are not expanded with artificial unreachable exceptions merely to obtain100% coverage. Mock boundary proof does not establish production auth/RLS, durable resets, provider delivery or recovery of encrypted records.

After verification, this worktree normally fast-forwarded to121's verified merged commit8ba80339408f1a848dbbda075b75490ebfa21356. The eight-document merge changed no executable verification input; the three pending paths and production route remain preserved.121PR46 passed exact-headCI before merge and its public production deployment reports SUCCESS; that metadata does not prove private workflows. No other tracked path is selected for127.
