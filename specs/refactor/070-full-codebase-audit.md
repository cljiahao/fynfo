---
id: 070
slug: full-codebase-audit
area: refactor
status: draft
author: Codex
created: 2026-10-08
approved:
shipped:
impl_pr:
constitution_satisfies:
  - '§7.4'
  - '§2.1'
  - '§2.3'
  - '§4'
  - '§5'
constitution_overrides: []
---

# Audit 070: Full codebase review and remediation

## Owner authorization

The owner explicitly requested a whole-codebase security, necessity, duplication,
maintainability, coverage, and performance review with improvements and a second
sweep in this conversation on 2026-10-08. This is an owner-authorized audit record
under constitution §7.4, not agent approval of a feature spec. Governance amendment
069 remains separate and uncommitted.

## Problem and scope

Inventory all tracked files and review their purpose, consumers, lifecycle, and
necessity. Review source, tests, public assets, configs, migrations, docs/specs,
and the non-secret harness. Never read real secret files, keys, environment dumps,
or cookies. Preserve historical migrations and approval records unless there is
specific evidence and authorization to change their lifecycle.

## Skills and review method

- templateCentral standards: Next.js standards, comment hygiene, validation,
  and drift guidance, preserving Fynfo's Supabase/action architecture.
- frontend-design: frontend hierarchy, usability, accessibility, and intentional
  reuse within the established semantic token system; no unsolicited redesign.
- cavecrew parallel scouts: independent domain reviews with compact findings and
  per-file ledgers; main agent verifies evidence and owns cross-cutting edits.
- Verification guidance: fresh results before claims, meaningful regression tests,
  and measured evidence before performance claims.
- Research uncertain security/framework claims with primary sources; record links.
- Second pass after remediation, explicitly recording unresolved limitations.

## Remediation batches

Before changing executable files, append the batch's findings, exact affected
paths, acceptance checks, and rollback here. Ordinary reversible remediation is
authorized by the owner's request. New dependencies, migrations, cryptographic
protocol changes, protected files, and deployment need separate permission.

Initial documentation scope: this record and `docs/audit/2026-10-08-*` ledgers and
report. These record investigation and evidence, without changing product behavior.

### Batch A: frontend privacy and failed-read safety

- Paths: `src/features/auth/hooks/use-idle-lock.ts`,
  `src/features/assets/components/investment-allocation.tsx`,
  `src/features/profile/components/profile-form.tsx`,
  `src/components/layout/vault-gate.tsx`, `src/app/dashboard/layout.tsx`,
  `src/features/auth/components/vault-unlock-flow.tsx`, and corresponding tests
  in `test/features/auth/`, `test/features/assets/`, `test/features/profile/`,
  and `test/components/vault-gate.test.tsx`.
- Evidence: idle lock waits for network settlement; plaintext allocation keys
  include financial tickers; failed profile reads fall back to editable defaults;
  dashboard children remain reachable beneath the visual lock overlay.
- Fix: lock/clear immediately, discard legacy plaintext allocation storage and
  keep target preferences in memory, render retry on failed profile read, gate
  dashboard content while locked and label the PIN field. Preserve the existing
  unlock flow and refetch behavior.
- Acceptance: meaningful regressions demonstrate stalled-network lock, no
  persisted tickers, no default-profile editing after failed read, and no locked
  dashboard content/keyboard targets. Full gates after integration.
- Rollback: restore this batch's paths only; no data/schema/protocol changes.

### Batch B: financial calculations

- Paths: `src/features/assets/lib/salary-plan.ts`,
  `src/features/expenses/lib/owed.ts`, `src/features/equity/lib/mwr.ts`, and
  corresponding salary-plan/owed/mwr tests.
- Evidence: insurance-only expense input divides by an empty category count;
  settled splits contribute to the unpaid summary; sell fees cancel algebraically.
- Fix: empty included-expense mean returns zero; unpaid totals exclude settled
  splits while preserving paid rows for the UI; sell cash flow is gross minus fees.
- Acceptance: regression tests for insurance-only input, mixed settlement, and
  both sides of fee calculation. Verify UI consumers before changing the owed sum.
- Rollback: restore this batch's paths only.

### Batch C: boundary, core, and tooling hygiene

- Paths: `src/app/auth/callback/route.ts`, `src/proxy.ts`,
  `src/app/api/vault/lock/route.ts`, `src/lib/action-guard.ts`,
  `src/lib/utils/currency.ts`, `src/lib/vault-migration.ts`,
  `eslint.config.mjs`, `.gitignore`, `README.md`, `.env.example`,
  `vitest.config.ts`, and regression tests under `test/api/`, `test/lib/`,
  `test/proxy-request.test.ts`, `test/proxy-routing.test.ts`,
  `test/auth-callback.test.ts`.
- Evidence: callback concatenates unchecked `next`; proxy blocks anonymous
  telemetry; idle endpoint leaves household key cookie active; key resolution
  races identity verification; currency helpers recreate Intl formatters;
  vault migration has no consumers and contains unsafe obsolete migration logic;
  README describes removed stack and nonexistent deployment files; secret env/key
  names are inadequately ignored; inline comment lint rule is absent.
- Fix: constrain callback to same-origin relative paths; expose only exact health
  and telemetry routes publicly; clear both vault cookies; authenticate before
  resolving keys; reuse Intl formatters with identical outputs; remove the unused
  migration helper after checking all consumers; repair setup docs/placeholder
  template and ignore patterns; enable built-in no-inline-comments with tooling
  directive exceptions; clean source/test trailing comments that violate it.
- Acceptance: regression tests for hostile redirects, anonymous routing, auth
  order, both cookie deletions and unchanged currency formatting; file consumer
  search; measured formatter benchmark; full gates and comment-rule audit.
- No SonarJS addition unless separately approved. No harness/CI/migration edits.
- Rollback: restore this batch's owned edits only.

### Batch D: failed-read replacement protection

- Paths: `src/features/assets/components/snapshot-form.tsx`,
  `src/features/assets/components/salary-planner.tsx`,
  `src/features/salary/components/salary-form.tsx`,
  `src/features/equity/hooks/use-prices.ts`, and corresponding component/hook
  tests under `test/features/assets/`, `test/features/salary/`,
  `test/features/equity/`.
- Evidence: editing snapshots/salary records after failed reads permits defaults
  to overwrite stored data; planner settings errors still enable autosave and
  pending debounce writes survive unmount/lock; quote hook sorts caller input.
- Fix: failed-read retry guards preserve cached data but block replacement until
  successful fetch; clear pending save timers on unmount; copy before sorting.
- Acceptance: failed-read forms cannot submit defaults, retry fetches again,
  unmount cancels save, stock-price hook does not mutate input; red/green tests.
- Rollback: restore the batch's owned paths only.

### Batch E: meaningful ownership-query regressions

- Paths: `test/helpers/fake-supabase.ts`,
  `test/helpers/fake-supabase.test.ts`, and existing snapshot, equity, dividend,
  expense, and household goal action tests under `test/features/`.
- Evidence: eq/in/order calls are no-ops; one shared currentTable can change
  pending queries' selected table. Ownership claims are not asserted.
- Fix: each from() captures its own table and chain/filter record; retain current
  fake API without simulating SQL/RLS. Assert actual ownership/identifier filters
  in delete/update tests and table isolation in concurrent queries.
- Acceptance: tests fail if scoped eq filters are removed; a pending table-A
  query still resolves table A after table B is constructed. Existing suite green.
- Rollback: restore these test/helper paths only.

### Batch F: server input and external quote boundaries

- Paths: `src/features/equity/actions/equity-actions.ts`,
  `src/features/equity/actions/price-actions.ts`,
  `src/features/equity/constants.ts`, and corresponding action tests.
- Evidence: trade schema trims ticker but actions ignore parsed data; price action
  permits unbounded fan-out and propagates malformed upstream quote fields.
- Fix: encrypt parsed normalized trade fields; validate ticker count/length and
  currency codes with Zod, cap concurrent quote requests and deadlines, validate
  finite quote/dividend values while preserving best-effort fallback results.
- Acceptance: whitespace normalization, rejected huge/malformed input before any
  fetch, malformed upstream data excluded, bounded in-flight requests, timeout
  configured, valid existing results preserved; regression tests and full gates.
- Rollback: restore the batch's owned paths only; no dependency/protocol changes.

## Acceptance

### Supplemental Batch G: household visibility, relief replacement, accurate trust copy

- Paths: `src/features/household/components/household-overview.tsx`,
  `src/features/salary/components/tax-reliefs-dialog.tsx`,
  `src/features/marketing/components/hero.tsx`,
  `src/features/marketing/components/security-band.tsx`,
  `src/features/marketing/constants.ts`,
  `src/features/profile/components/export-data-card.tsx`,
  `test/features/household/household-overview.test.tsx`,
  `test/features/salary/tax-reliefs-dialog.test.tsx`.
- Evidence: disabled household goal queries retain cached goals visible while locked;
  relief read errors allow full-year replacement defaults and failed writes close the
  dialog/update the parent anyway; marketing/export copy falsely claims client-only
  encryption and a complete export despite server processing and limited export domains.
- Fix: gate goal/action/invite rendering on authoritative household unlocked state;
  failed relief reads require retry and successful save precedes close/parent updates;
  describe browser PIN derivation, server encryption/decryption and encrypted database
  storage accurately. List current export domains without changing export schema.
- Acceptance: locked household with populated cache exposes no goals/actions;
  failed cached relief read exposes no Confirm; pending/rejected save does not close
  or commit parent totals; successful save does. Copy reviewed against actual action
  and export flow, with false promises removed. Regression red/green and full gates.
- Rollback: restore this batch's paths only. No dependency, schema or crypto change.

- [x] Per-file inventory accounts for the tracked tree and exclusions.
- [x] Evidence-backed findings reviewed and scoped authorized fixes applied;
      unresolved contracts and permission-dependent work listed in the summary.
- [x] README and comments reflect final behavior; no speculative abstractions.
- [x] Regression tests for behavior changes and security-critical paths.
- [x] Formatting, lint, typecheck, tests, coverage, and build verified where feasible;
      limitations and secret-free build conditions recorded.
- [x] Second sweep completed with file coverage and residual risks documented.
- [x] Protected changes/new dependencies proposed separately, never silently accepted.

## Risk and reversibility

Existing uncommitted governance edits must be preserved. Keep coherent batches
and restore only audit-owned edits if backing out. No production/database access,
secret reads, deployment, history rewriting, or automatic commits.

## Open questions

### Supplemental Batch O: shared logout session teardown

- Frontend paths: `src/features/auth/hooks/use-sign-out.ts`,
  `src/features/auth/hooks/index.ts`, `src/features/auth/index.ts`,
  `src/features/auth/components/signout-button.tsx`,
  `src/features/auth/components/vault-unlock-flow.tsx`,
  `src/components/layout/user-menu-dropdown.tsx`,
  `test/features/auth/use-sign-out.test.tsx`.
- Existing unlock regression adapts its provider fixture in
  `test/features/auth/vault-unlock-flow.test.tsx` and asserts locked logout retry UI.
- Server/proxy paths (root-owned): `src/app/api/vault/lock/route.ts`,
  `src/proxy.ts`, `test/api/vault-lock.test.ts`,
  `test/proxy-request.test.ts`, `test/proxy-routing.test.ts`.
- Evidence: duplicate logout handlers sign out Supabase but leave personal and
  household vault cookies. Existing authenticated lock endpoint cannot teardown
  expired/outage sessions; redirect on errors enables stale account switching.
- Fix: shared client hook locks/clears immediately, awaits POST cookie teardown
  with bounded timeout, then signs out and navigates only on success; opaque
  failure keeps locked state. Root makes the exact POST lock route idempotently
  expire both cookies without auth/DB and marks only that exact path public.
- Acceptance: request order/local clear, rejected/non-OK/timeout key teardown
  prevents auth logout/navigation; auth signout error prevents navigation; success
  completes. Both cookie expiry and exact route public/prefix protected tests.
- Guidance: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
  supports explicit session invalidation. No format/crypto changes; identity
  binding of existing cookie protocol remains a separately gated residual.
- Rollback: restore Batch O paths only.

### Supplemental Batch K: deferred disclosure and isolated optimistic rollback

- Paths: `src/features/expenses/components/editable-expense-row.tsx`,
  `src/features/expenses/hooks/use-expenses.ts`,
  `src/features/profile/hooks/use-export-data.ts`,
  `test/features/expenses/expense-lifecycle.test.tsx`,
  `test/features/expenses/expense-rollback.test.ts`,
  `test/features/expenses/use-expenses-options.test.ts`,
  `test/features/profile/use-export-data.test.tsx`.
- Personal export completeness supplement paths: `src/features/profile/lib/export-data.ts`,
  `test/features/profile/export-data.test.ts`, `src/features/profile/components/export-data-card.tsx`,
  `test/features/marketing/constants.test.ts`,
  `src/features/marketing/constants.ts`, `README.md` (root integrates README).
  Add personal dividends to the all-or-nothing read/export, bump envelope version
  to 2 per its existing contract; verify serialized dividend values and failed
  dividend read prevents partial download. Household export remains excluded.
- Evidence: row blur save survives unmount; pending export downloads plaintext
  after vault gate unmount; failed optimistic mutations restore entire snapshots,
  dropping later successful edits and recreating cache removed by lock.
- Fix: cancel row timer on unmount; suppress export completion/disclosure after
  unmount; rollback only mutation-owned rows still at its optimistic version in
  the same query instance. Preserve unrelated/later changes and avoid removed
  query resurrection. Keep existing server actions and export schema.
- Acceptance: deferred row save/export do nothing after unmount; concurrent
  failures preserve unrelated and newer successful changes; removed/recreated
  query never receives old rollback; initially absent-cache failed insert removed.
  Red/green regression tests and integrated gates.
- Rollback: restore these paths only; no new deps, crypto or protected edits.

New SonarJS dependency and actual harness permission/read guards may require
separate approval after concrete proposals are prepared. Existing harness drift
must be reported without rebasing unrelated hashes.

### Batch H: failed single-record reads and enforced test gates

- Paths: `src/features/assets/actions/snapshot-actions.ts`, `src/features/salary/actions/salary-actions.ts`, corresponding `test/features/assets/snapshot-actions.test.ts` and `test/features/salary/salary-actions.test.ts`, `test/helpers/fake-supabase.ts`, `package.json`, `vitest.config.ts`, `README.md`.
- Evidence: both single-record reads return null on every database error, so editors cannot distinguish missing records from failed reads. test:ci skips existing coverage thresholds and passWithNoTests permits empty discovery.
- Fix: add failed-read regressions first; use maybeSingle and opaque throwIfSupabaseError, preserving null for absence. Add minimal helper maybeSingle. Enable existing coverage provider in test:ci and disable passing empty discovery; document actual commands without new dependencies or threshold reductions.
- Acceptance: regressions fail against previous actions, pass after changes; absence and valid decrypted records preserved; existing coverage thresholds enforced and missing tests fail; targeted tests/typecheck/format followed by consolidated full gates.
- Rollback: restore this batch's paths only.

Batch E scope clarification: `test/features/salary/tax-reliefs.test.ts` is included for replacing four fixture-dependent early returns with explicit failing assertions; no catalog or tax rule changes.

### Batch J: canonical vault input and log privacy

- Paths: `src/app/api/vault/route.ts`, `src/lib/errors/supabase-error.ts`,
  `src/lib/utils/with-logging.ts`, `test/api/vault.test.ts`,
  `test/lib/errors/supabase-error.test.ts`, `test/lib/with-logging.test.ts`.
- Evidence: permissive base64 decoder accepts oversized/noncanonical keys;
  raw database details can contain financial/identity values; caller request IDs
  are unbounded and copied into logs.
- Fix: require canonical 44-character base64 for exactly 32 bytes, retain only
  database context/code in logs, generate server request correlation IDs.
- Acceptance: malformed keys rejected before writes; private database text is
  absent from log arguments; hostile request IDs never echoed/logged. Red/green.
- Rollback: restore these paths only; no cookie or encryption protocol change.
- Reference: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

### Batch I: checked child replacement

- Paths: `src/features/expenses/actions/expense-actions.ts`,
  `src/features/assets/actions/snapshot-actions.ts`,
  `test/features/expenses/expense-actions.test.ts`,
  `test/features/assets/snapshot-actions.test.ts`.
- Evidence: child deletion errors ignored and expense deletion races parent write.
- Fix: encrypt children before deletion; sequential parent success, checked delete,
  then insert. No transaction or primary-key contract changes in this batch.
- Acceptance: regression errors prevent inserts after delete failures and prevent
  deletes after parent/encryption failures. Full gates; atomicity remains residual.
- Rollback: restore these paths only.

### Batch L: unused generated UI

- Paths: `src/components/ui/button-group.tsx`, `src/components/ui/form.tsx`,
  `src/components/ui/input-group.tsx`, `src/components/ui/shadcn-io/dropzone/index.tsx`,
  `src/components/ui/sonner.tsx`, `src/components/ui/tabs.tsx`.
- Evidence: full static import ledger plus source/test string search finds no
  consumers, route conventions or runtime entry points for these six primitives.
- Fix: remove unused generated primitives; CLI can regenerate if needed later.
- Acceptance: TypeScript, full tests, lint/build validate no consumers removed.
- Rollback: restore exactly these six files from Git; no public behavior change.

### Batch M: concise standalone comments

- Paths: `src/features/admin/types.ts`, `src/features/assets/constants.ts`, `src/features/assets/types.ts`, `src/features/equity/components/yield-on-cost-table.tsx`, `src/features/equity/lib/broker-fees.ts`, `src/features/equity/lib/dividend-scan.ts`, `src/features/equity/lib/dividend-suggest.ts`, `src/features/equity/lib/mwr.ts`, `src/features/equity/lib/ticker-map.ts`, `src/features/equity/types.ts`, `src/features/expenses/components/expense-chart.tsx`, `src/features/expenses/lib/owed.ts`, `src/features/expenses/types.ts`, `src/features/profile/lib/export-data.ts`, `src/features/salary/types.ts`, `src/lib/crypto-constants.ts`, `src/lib/crypto.ts`, `test/api/vault.test.ts`, `test/features/assets/investment-math.test.ts`, `test/features/assets/salary-plan.test.ts`, `test/features/equity/dividend-actions.test.ts`, `test/features/equity/dividend-metrics.test.ts`, `test/features/equity/dividend-scan.test.ts`, `test/features/equity/holdings.test.ts`, `test/features/equity/mwr.test.ts`, `test/features/expenses/expense-quick-add.test.tsx`, `test/features/expenses/expense-table.test.ts`, `test/features/expenses/split-confirm.test.ts`, `test/features/household/household-actions.test.ts`, `test/features/marketing/constants.test.ts`, `test/features/profile/export-data.test.ts`, `test/features/salary/tax-cpf.test.ts`, `test/lib/crypto.test.ts`, `test/lib/household-key.test.ts`.
- Evidence: ESLint identifies trailing comments contrary to templateCentral standards.
- Fix: preserve format/unit/fixture rationale as concise preceding comments; remove color narration and self-evident arithmetic/assertion narration. No executable edits.
- Acceptance: fresh lint, formatting, full tests and diff review.
- Rollback: restore comment-only hunks in these paths.

### Batch N: nonblocking invite key derivation

- Paths: `src/lib/household-key.ts`,
  `src/features/household/actions/household-actions.ts`,
  `test/lib/household-key.test.ts`,
  `test/features/household/household-actions.test.ts`.
- Evidence: synchronous PBKDF2 with 600,000 iterations blocks server event loop.
- Fix: use callback-based asynchronous PBKDF2 and await callers, preserving
  all salt, algorithm, iteration, key-length and ciphertext protocol parameters.
- Acceptance: identical fixed-vector key bytes; promise API and event-loop
  responsiveness regression; existing household crypto/action tests green.
- Rollback: restore the four paths only.

### Batch P: existing framework security update and unused dependency

- Paths: `package.json`, `pnpm-lock.yaml`; README version text if needed.
- Evidence: installed Next16.2.6 predates July App Router Server Actions DoS
  fix and subsequent security maintenance. Source/test import audit found no
  remaining react-dropzone consumer after Batch L.
- Fix: update existing next and eslint-config-next packages to16.3.8 (September
  security release, retaining Next16 stack); remove unused react-dropzone direct
  dependency. No new direct dependency or feature is authorized by this batch.
- Acceptance: lockfile consistency, fresh lint/type/tests/coverage and isolated
  fixture production build; verify actual installed versions. No scripts/hooks edits.
- Rollback: restore package/lock changes and reinstall original pinned dependencies.
- References: https://nextjs.org/blog/july-2026-security-release and
  https://nextjs.org/blog/september-2026-security-release

### Batch O server boundary: idempotent key-cookie teardown

- Paths: `src/app/api/vault/lock/route.ts`, `src/proxy.ts`,
  `test/api/vault-lock.test.ts`, `test/proxy-routing.test.ts`.
- Evidence: authentication expiry or Supabase failure prevents clearing local
  vault key cookies. Logout must not carry keys into the next account session.
- Fix: exact lock endpoint only expires caller cookies without auth/DB access;
  proxy allows this teardown route even after auth expiry. No cookie reads.
- Acceptance: both cookies expired for anonymous calls; no auth network call;
  similarly prefixed endpoints stay protected. Red/green plus shared logout tests.
- Rollback: restore four paths; no cookie-envelope/crypto format changes.
- Reference: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

### Batch J supplement: unknown-error log privacy

- Paths: `src/lib/errors/handle-api-error.ts`, `src/lib/utils/with-logging.ts`,
  `test/lib/handle-api-error.test.ts`, `test/lib/with-logging.test.ts`.
- Fresh reviewer found raw exception strings still bypass field-name redaction.
- Fix: log controlled Error/unknown classification and route/correlation context,
  preserve opaque HTTP mapping and exception propagation without raw message/stack.
- Acceptance: private fixture text absent from both logger argument lists;
  status mapping and thrown exception identity preserved. Regression red/green.
- Rollback: restore these privacy-only hunks.

Batch N supplemental acceptance: test/lib/household-key.test.ts will exercise a PBKDF2 provider callback error and assert the derivation Promise rejects with that error. Crypto parameters and implementation remain unchanged; mock restoration uses finally. This closes error-path coverage for the existing recorded batch.

### Batch Q: formatter scope

- Path: `.prettierignore`.
- Evidence: whole-tree formatter includes untracked generated .impeccable cache;
  formatter should exclude real env/credential/key content explicitly.
- Fix: ignore generated .impeccable cache and real env/cert/key/credential paths,
  retaining .env.example as allowed template (no parser added).
- Acceptance: complete formatting check passes without accessing secret content.
- Rollback: restore added ignore entries only.

## Owner continuation — coverage and runtime verification

On2026-10-08 the owner approved adding SonarJS and requested coverage above80%
plus investigation of bugs and project runtime verification. This explicitly
approves eslint-plugin-sonarjs4.2.0 development dependency and package/lock/lint
changes. It does not approve secret access, migrations or cookie protocol changes.

### Batch R: targeted lint and coverage enforcement

- Paths: package.json, pnpm-lock.yaml, eslint.config.mjs, vitest.config.ts,
  README.md, docs/audit/2026-10-08-summary.md and supplemental test files.
- Add approved SonarJS plugin with targeted commented-code/duplication rules;
  assess real findings before broad gates. Preserve current coverage include/
  exclude definitions and existing per-file security floors; set global floors
  to81% after meaningful tests reach that target for all four metrics.
- Verify lint/type/tests, production build, isolated fixture browser/HTTP smoke
  tests. No mock authentication bypass in production; real secrets excluded.
- Rollback restores only continuation-owned hunks.

### Batch S: assets and salary behavioral coverage

- Scope: new/updated tests under test/features/assets and test/features/salary
  exercising currently untested components/hooks, real DOM interactions, loading,
  empty, success/error and mutation paths. Actual UI/math components remain real;
  mock external actions/quotes only when needed. Add exact source paths to this
  record before any independently reproduced bug fix; no speculative model changes.

### Batch T: equity behavioral coverage

- Scope: new/updated tests under test/features/equity for forms/tables/charts/hooks
  and validation/mutation states. Preserve official-rule/currency contract boundaries.
  Record exact source bug fix paths before edits. No schema/dependency/protocol edits.

### Batch U: expenses and household behavioral coverage

- Scope: new/updated tests under test/features/expenses and test/features/household
  exercising forms/tables/chart/hook interactions, settlement, errors, lifecycle.
  Record exact ordinary bugfix paths before source edits. No migrations/key format edits.

### Batch V: core and app runtime coverage

- Scope: tests under test/components, test/lib, test/api, test/features/auth,
  test/features/profile, test/features/marketing and test/app covering real component
  behavior, auth/route boundaries, public layout/content and safe runtime smoke.
  Add exact paths before source fixes; do not read actual env/credentials.

### Batch W: owner-reported snapshot update failure

- Paths: src/features/assets/actions/snapshot-actions.ts,
  test/features/assets/snapshot-actions.test.ts; related real form interaction
  regression in Batch S under test/features/assets.
- Evidence: monthly_snapshots.id is TEXT primary key with no default; asset_entries
  references it with ON DELETE CASCADE but no ON UPDATE CASCADE. Unchanged-month
  edits upsert a fresh UUID and violate the existing child foreign key before
  replacement. The owner reports inability to update a saved snapshot.
- Fix: all edits with originalId update the existing authenticated month row and
  reuse its returned ID, whether month is renamed or unchanged. Create remains
  a separate existing upsert path; no schema/protocol change or extra read roundtrip.
- Acceptance: saved same-month edit preserves parent/child ID, encrypts updated
  values, no upsert/rekey attempted; existing rename/collision/newmonth/error cases.
- Rollback: restore this batch's source/test hunks.

Batch U source remediation scope: `src/features/household/components/invite-panel.tsx` plus `test/features/household/household-workflows.test.tsx`. Evidence: navigator.clipboard.writeText rejection is unhandled, leaving no feedback when copying a one-time invitation fails. Reproduce clipboard denial before fix; catch it and show an opaque failure notification while preserving the visible code for manual sharing. Acceptance: denied copy never emits success or unhandled rejection and retains code; successful exact copying remains green. Rollback only this source hunk and regression.

Batch T narrow runtime fix: src/features/equity/components/trade-form.tsx and test/features/equity/equity-ui.test.tsx. Evidence: clearing optional native date field reaches Date.toISOString before validation/error handling and throws RangeError. Acceptance: empty date submission shows required-fields toast, makes no create/update call, produces no unhandled rejection; valid trade behavior retained. Rollback: restore these two paths. No model/currency/tax/protocol changes.

Batch T deletion error feedback: src/features/equity/components/trade-table.tsx, src/features/equity/components/dividend-table.tsx, test/features/equity/equity-ui.test.tsx. Evidence: row confirmation awaits mutation with no catch, so a rejected server action escapes the event callback without toast feedback. Acceptance: failed deletion keeps confirmation visible, emits opaque failure toast, no success toast/unhandled rejection; successful scoped deletion unchanged. Rollback these paths. No shared confirmation primitive or model changes.

Batch U second source remediation: `src/features/expenses/components/expense-quick-add.tsx`, `test/features/expenses/expense-workflows.test.tsx`, and existing `test/features/expenses/expense-quick-add.test.tsx`. Regression reproduced: first failed row of a multi-row paste rolls back but receives no error notification when a later mutation succeeds; per-call mutate callbacks follow the latest observer. Bind each multi-row error notification to its own mutateAsync promise, still without awaiting or delaying immediate reset. Acceptance: every failed row reports its failure independently, valid rows remain cached, immediate reset characterization remains green. Rollback only these owned hunks.

Batch T telemetry privacy follow-up: src/lib/validation/track-event.ts, test/lib/validation/track-event.test.ts, test/api/track.test.ts. Route src/app/api/track/route.ts is reviewed boundary consumer; no route implementation change expected. Evidence: arbitrary path persists query-embedded identity despite non-PII carve-out. Fix: allow only supported public marketing page paths '/' and '/login', retaining actual frontend pathnames. Acceptance: private query/fragment/control/backslash/absolute/private paths return400 before database write, with no private value reflected; valid public events unchanged. Rollback schema/tests only. DB direct insert policy remains separately permission-gated residual.

Batch T snapshot frontend duplicate guard: src/features/assets/components/snapshot-form.tsx and test/features/assets/snapshot-duplicate-submit.test.tsx. Existing query-fed duplicate message/disabled button is retained; add submission-boundary guard against duplicate month (except edited original month), preventing keyboard/programmatic form submit bypass. Acceptance: duplicate submission no mutation/navigation; unique month and existing edit behavior pass existing suites. UI safeguard only; cannot promise atomic duplicate prevention across sessions or truncated histories. Snapshot backend owned by root and unchanged here.

Batch U callback scope extension: same expense-quick-add source/test paths, with repeated single-row paste failure reproduced separately. Bind single paste and manual-add success/error notifications to each returned mutation promise too; preserve immediate reset and hook-level optimistic/error behavior. Acceptance includes earlier failure visibility after later success, unchanged per-submit payload and immediate reset characterization.
