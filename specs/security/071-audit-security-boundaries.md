---
id: 071
title: Repair database authorization and bind key-session envelopes
status: approved
created: 2026-10-08
approved: 2026-10-08
---

# Owner-approved security follow-up

## Problem and evidence

Audit070 findings FD01–04 and its summary identify direct-RPC authorization gaps
and key-session envelopes without user/purpose/expiry binding. Mocked application
tests cannot prove these database boundaries. Implementation is owner-approved;
production migration execution and credential access remain outside approval.

## Scope and decisions

- Add forward-only SQL migrations under `supabase/migrations/`, leaving historical
  migrations untouched. Direct authenticated callers must not be able to reset
  vault throttling by asserting success. Choose a trusted, least-privilege reset
  boundary before implementation; document any new owner-supplied configuration.
- Make invite consumption verify secret proof inside the transaction, serialize
  membership/capacity checks on the household row, and enforce the intended
  one-household/two-member contract. Inspect conflicting existing memberships
  separately; do not delete or automatically select an existing household.
- Review telemetry table/RPC grants so direct Data API callers cannot bypass
  non-PII ingestion and admin-read boundaries.
- Update `src/lib/cookie-seal.ts`, `src/lib/keystore.ts`,
  `src/lib/household-keystore.ts`, `src/lib/vault-cookie.ts`,
  `src/lib/household-cookie.ts`, vault/invite session setters and their tests.
  The sealed envelope
  must contain authenticated user ID, purpose, version and internal expiry.
  Verify these fields before returning a key. Reject legacy/stale envelopes and
  prompt unlock again; keep existing encrypted records and PIN derivation intact.
- Reconcile financial delete guard exceptions against approved specifications
  before changing their authorization contract.

## Invariants and risks

Preserve CONSTITUTION§2 identity/ownership, §5 key handling and recoverability,
§7.4 scoped permission, and §8.2 secret restrictions. Do not read real env files,
private keys, live cookies or production data. Local SQL verification uses a
disposable fixture database only. No production migration/deployment is included.
New dependencies require separate approval. Existing sessions will need unlock
again; enforcing membership constraints may reveal inconsistent historical data.
Do not claim a trusted reset solution until its privilege model is verified.

## Acceptance and verification

1. Direct authenticated-RPC tests cannot reset a lockout without trusted proof;
   concurrent failures cannot evade the intended threshold.
2. Missing/incorrect invite proof cannot join or consume an invite. Concurrent
   distinct invites cannot exceed capacity or create multiple memberships.
3. Telemetry direct-access negative tests prove the chosen database boundary.
4. Replay a fixture sealed key under another user, purpose, expired time or old
   format: all fail closed before financial database access. Correct envelopes
   still unlock existing encrypted fixture records.
5. Test relevant server actions, real form error/retry behavior, all existing
   quality gates and global81% coverage floors.

## Rollout and rollback

Review the exact SQL and privilege model before any application. Stage and test
against disposable fixtures first, then provide a separate deployment/data plan
for owner review. Use corrective forward migrations instead of rewriting history
or removing data. Roll back source changes only with an explicit compatible
session strategy; never restore permissive authorization to conceal errors.

## Approval

Clarence approved this linked proposal with "yes please go ahead" on2026-10-08.
This records explicit human approval for scoped database/session implementation,
not agent-invented approval. It excludes production migration/deployment, secret
access, new dependencies and protected enforcement files.

## Root integration and verification scope

### Trusted throttle and telemetry batch

Paths: new supabase/migrations/20261008000000_security_rpc_boundaries.sql,
src/integrations/services/security-rpc.ts, src/app/api/vault/route.ts,
src/app/api/track/route.ts, src/features/admin/lib/get-marketing-stats.ts,
.env.example, README.md, test/api/vault.test.ts, test/api/track.test.ts,
test/features/admin/get-marketing-stats.test.ts, new test/integrations/security-rpc.test.ts,
and test/security/vault-telemetry-authorization.sql plus fixture runner/docs.

Evidence: authenticated reset RPC trusts an asserted success; separate lock/check
and failure recording permit concurrent guesses. Telemetry direct grants bypass
the HTTP ingestion and admin boundary. Create service-role-only reserve/finish
RPCs: atomically reserve one of five pending/failure slots under a counter row
lock before verification; expire abandoned slots as failures; finish consumes
a user-bound one-use reservation. Only verified canary success resets failures,
leaving other pending reservations intact. Revoke legacy reset execution from
PUBLIC, anon, authenticated and service_role. Missing RPC/config fails closed.

Use an RPC-only server-only facade with the existing Supabase dependency and
owner-configured SUPABASE_SECRET_KEY. This is a privileged service_role credential
that bypasses RLS: the facade limits application calls but does not reduce the
credential's inherent blast radius. Do not expose the raw client or use this
client for financial data. Runtime config is documented in .env.example with a
blank placeholder; no real env/key is read. Bound network waits to10 seconds.
Telemetry insertion and aggregates use this facade after HTTP validation/admin
identity checks. Database RPCs also validate allowed public paths; revoke direct
browser ingestion and aggregate execution. Existing telemetry rows are retained.

Acceptance: real anonymous/authenticated role tests reject old/new throttle
calls, inserts and admin RPCs; trusted reserve handles simultaneous first attempts,
five failures, abandoned slots, UID mismatch, replay and successful reset while
preserving pending work. Application tests reject missing/malformed/error RPC
responses before issuing cookies; preserve valid first/returning unlock behavior.
Rollback is a reviewed corrective forward migration and compatible application
rollout, never restoration of permissive public grants. Production deployment
requires coordinated migration/config/source rollout and remains separately gated.

Paths: src/lib/action-guard.ts, src/app/dashboard/layout.tsx,
src/app/api/vault/route.ts, src/features/household/actions/household-actions.ts
and related tests. Pass already verified user IDs into key-session readers and
setters without duplicate authentication. Snapshot/action ownership filters stay.

Local SQL tests use a new disposable PostgreSQL17 fixture cluster under the
visualization workspace, bound only to127.0.0.1:55471 with fixture roles/data.
No existing PostgreSQL configuration/services, production databases, secret
files or connection environment values are read. Replay relevant non-destructive
historical schema into this new fixture and execute direct-role/concurrency tests.

templateCentral migration guidance was reviewed: its Drizzle-to-Kysely conversion
is inapplicable to Fynfo's Supabase stack. No ORM swap, migration-history deletion,
real env edit or added dependency is performed. Existing standards/comments,
TDD and independent parallel review guidance inform this implementation.

## Cookie-session binding implementation batch (2026-10-08)

Owner explicitly approved spec071 in the subsequent conversation with “yes”; root delegated this independently scoped session batch. This records that authorization and does not approve unrelated operations. Exact owned paths: `src/lib/cookie-seal.ts`, `src/lib/keystore.ts`, `src/lib/household-keystore.ts`, `src/lib/vault-cookie.ts`, `src/lib/household-cookie.ts`, `test/lib/cookie-seal.test.ts`, `test/lib/keystore.test.ts`, `test/lib/household-keystore.test.ts`, and new `test/lib/key-cookie-boundaries.test.ts`. Root owns caller integration and corresponding action/API/layout tests.

Evidence: existing seal/open accept arbitrary plaintext, and getters decode raw base64 without checking key length, identity, purpose or server expiry. The same session-secret envelope can be replayed across account or cookie-purpose boundaries. Add an authenticated encrypted JSON envelope with version1, userId, purpose, canonical32-byte key, issuedAt and expiresAt; retain AES-256-GCM sealing and existing record ciphertext/PBKDF2. Explicit authenticated user IDs flow through getters/setters without an extra Supabase auth request. Purpose literals are `vault-dek` and `household-kh`; internal expiration matches the existing six-hour cookie lifetime. Legacy sessions fail closed and require unlock again.

Acceptance: independently forged fixture envelopes and real seal/getter tests reject malformed/noncanonical data, legacy plaintext, altered ciphertext, wrong user/purpose/version, expired/future/inconsistent timestamps, and wrong-size keys; valid envelopes return the original key and decrypt existing fixture records. Prove baseline failure before source changes, then focused tests, scoped lint/typecheck and independent final review. No real secret/environment/cookie reads, new dependencies, enforcement files or database changes in this batch. Rollback requires a compatible explicit session strategy; never silently reaccept unbound legacy sessions. OWASP [Session Management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) supports server-enforced expiration and binding identity/access control to session management. TDD and writing-good-tests references inform the regression fixtures; templateCentral comment guidance preserves public security contracts.

Cookie batch results: baseline26 boundary regressions failed for the expected unbound/unchecked legacy behavior; after implementation4files47tests pass. Isolated `coverage/cookie-071` reports100% lines/statements/functions/branches across the five owned library files without changing configured gates/exclusions. Scoped ESLint (max-warnings0) and diff whitespace checks pass. Typecheck validates the owned implementation; its nine current errors are the root-owned caller sites awaiting explicit identity/purpose arguments (vault route2, dashboardlayout1, householdactions4, actionguard2). A valid bound DEK decrypts an unchanged encrypted record fixture. Independent final review checked authenticated metadata, canonical encodings/32-byte lengths, strict outer/inner shape, safe integer timestamps, exact six-hour duration, expiry boundary/future issuance, IV/tag lengths, and limits on attacker-provided cookie size. No live cookies, real configuration values or production records accessed; no claim of live database/deployment verification. Existing cookie values deliberately require unlock again; same-user/same-purpose replay remains possible within the absolute six-hour lifetime, with logout relying on cookie teardown rather than a server revocation registry.

## Household SQL authorization implementation batch (2026-10-08)

Owner approved spec071 in conversation; root records the approval frontmatter. Exact paths: `supabase/migrations/20261008000001_household_authorization.sql`, `test/security/household-authorization.sql`, `test/security/household-concurrency.ps1`. No historical migration or application caller edits in this independently owned batch. Root owns caller integration and disposable PostgreSQL bootstrap.

Evidence FD02–04: UUID-only consume does not verify secret proof; invite-only locks do not serialize distinct invites; membership uniqueness covers only household/user pairs; direct invite UPDATE permits replacing proof and consumption metadata. Add four-argument consume with secret-derived SHA256 hash verification, revoke legacy RPC execution, unique user membership, owner-only invite management and immutable membership/household identity through column grants. Cap trigger covers INSERT/UPDATE and uses the shared household row as serialization point. A same-value parent UPDATE creates a row version so competing repeatable-read transactions fail safely instead of using stale member counts. Preflight existing duplicate users and over-cap households abort without choosing/deleting records.

Acceptance: actual authenticated/anonymous role SQL tests cover wrong/missing proof, caller mismatch, expiry/replay, direct grants/RLS bypass attempts, legitimate owner bootstrap/join and capacity on privileged UPDATE; independent sessions test distinct-invite capacity and same-user competing joins. Capture vulnerable baseline before applying the forward migration, then green proof against credentialless disposable local PG17 only. Rollback uses a corrective forward migration; never restore permissive grants or remove memberships. TemplateCentral migration guidance was reviewed, preserving Fynfo raw SQL/Supabase deviations and installing no packages. PostgreSQL [row locks](https://www.postgresql.org/docs/17/explicit-locking.html), [RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), and [transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html) inform privilege/snapshot tests.

## FD17 remediation scope — owner-approved 071

- Source paths: `src/features/assets/actions/snapshot-actions.ts`, `src/features/salary/actions/salary-actions.ts`, `src/features/equity/actions/equity-actions.ts`, `src/features/equity/actions/dividend-actions.ts`, `src/features/expenses/actions/expense-actions.ts`, `src/features/household/actions/goal-actions.ts`.
- Regression path: `test/features/financial-vault-guards.test.ts`; existing corresponding action suites retained for unlocked behavior and exact query scope.
- Switch personal deleteSnapshot/deleteSalaryRecord/deleteTrade/deleteDividend/deleteExpense, settleSplit/settleMonthSplits and getDistinctPeople from auth-only to identity-plus-personal-vault context. Switch deleteGoal to identity-plus-household-key context. Preserve query filters, payloads, returned values and opaque errors. Plain profile/planner/membership metadata reads remain auth-only.
- Historical039's auth-only delete instruction contradicts its own every-action-vault claim and declares no override;054 requires household context for all goal actions;058 deferred correcting deleteGoal, not a constitutional exemption.017 changes cache only, with server actions explicitly out of scope.071 reconciles these behaviors to constitution§2.3.
- Acceptance: with a genuinely authenticated fixture user but absent personal/household key, real action guards reject before financial from()/rpc(); regressions fail before changes. Existing unlocked action/query tests pass afterward. Root owns shared guard and cookie-user binding changes.
- Limitation: these server-action checks do not add vault proof to direct authenticated Data API calls permitted by existing financial RLS. No cross-user disclosure or database-wide vault-lock enforcement is claimed. Rollback affects only these owned source/test hunks.

Supplemental exact path `test/security/household-conflicts.sql`: parent authorized disposable fixture-only transactional constraint/trigger changes, rolled back, to execute migration preflight against conflicting memberships without touching production or rewriting historical migrations. The fixture verifies conflicts are rejected and records remain unchanged; never apply this test to a live database.

Household verification outcome: actual PG17 historical baseline failed `test/security/household-authorization.sql` with `REGRESSION: UUID-only consume succeeded`. Forward migration applied successfully to the disposable fixture. Real authenticated/anonymous role suite now passes missing/wrong proof, caller mismatch, replay/expiry, owner bootstrap, invite proof/member role/creator mutation denials, member invite creation/read denial, privileged UPDATE capacity enforcement and successful atomic membership/consumption. Independent PostgreSQL connections prove one winner for distinct-invite capacity under READ COMMITTED and REPEATABLE READ, and one winner for the same user joining distinct households. Executed actual migration preflight block against duplicate-user and over-cap fixture data; both reject, and connection rollback restores constraint/trigger/data. No production data or credentials accessed. The new SQL tests are separate integration scripts, not coverage-inflating Vitest assertions. Deployment remains owner-scoped and requires existing-data conflict inspection plus migration privileges review in staging.

## Portable real-SQL fixture runner batch (2026-10-08)

### Independent trusted facade boundary tests

Supplemental exact source path `src/integrations/services/security-rpc.ts`: root authorized only the aggregate-count schema hunk after independent review found `z.coerce.number()` accepts null, false, empty string and empty array as zero. Add failing boundary regressions in `test/integrations/security-rpc.test.ts`, then restrict inputs to number or decimal-digit string before existing safe nonnegative integer coercion. Preserve valid Postgres bigint strings, RPC names/options, timeouts and other facade behavior. Rollback is this narrow schema/test hunk; no dependency, secret or SQL changes by reviewer.

Root delegated a final read-only security review and independent tests under approved071. Exact new path: `test/integrations/security-rpc.test.ts`. Production remains root-owned: `src/integrations/services/security-rpc.ts`, vault/track routes, admin telemetry reader and forward SQL. Tests keep the real facade and mock only Supabase SDK/network boundaries; exercise missing configuration, opaque service errors/throws, malformed reservation/finish/aggregate replies, nullable reservation denial versus UUID token, exact RPC arguments, disabled SDK auth persistence/refresh/URL parsing, private raw-client boundary and bounded fetch cancellation. Use fixture-only configuration and no real environment/cookie/config access. Acceptance is focused test/lint/typecheck and independent source/SQL control-flow review; no deployment or credential handling changes by reviewer.

Exact paths: `scripts/test-security-sql.mjs`, `test/security/bootstrap.sql`, new `test/security/household-concurrency.mjs`, existing `test/security/household-concurrency.ps1` (remove after consumer search), and the preceding household SQL fixture scripts. Root owns `test/security/vault-concurrency.mjs` and `test/security/vault-telemetry-authorization.sql`. Build a single dependency-free Node child-process runner with explicit PostgreSQL bin path, new data directory and localhost port. Initialize credentialless disposable PostgreSQL, replay the nine relevant nondestructive historical migrations plus the two forward migrations, run real role suites and concurrent workers, stop PostgreSQL in finally, retain all data/logs for inspection. Never read env/config secrets, connect to production, install dependencies, modify CI/harness, or recursively remove directories. Acceptance: fresh end-to-end fixture run proves role denials, real overlapping capacity/membership races, migration conflict preflight and root vault concurrency/expiry checks. Rollback removes only added source harness files; retained fixture data is owner-managed. Consumer search found no executable consumer of the old PowerShell runner.

The portable command is `node scripts/test-security-sql.mjs --pg-bin "C:/Program Files/PostgreSQL/17/bin" --data-dir "<new disposable directory>" --port 55472`. The directory must not exist, binaries must already be installed, and logs/data remain after PostgreSQL stops. Host-specific PostgreSQL binary suffix is selected automatically; process arguments never pass through a shell. All fixture children use `windowsHide: true`; each subprocess has a30-second timeout and PostgreSQL startup/shutdown waits20seconds. `test/security/household-concurrency.mjs` replaces the superseded PowerShell runner; its source, conflict fixtures, assertions and observed-lock proof remain unchanged.

Independent facade review outcome: malformed scalar count regressions reproduced five failures among thirty tests before the bounded input schema; all thirty now pass, including valid bigint strings and rejection of null, booleans, arrays, objects, fractional strings and unsafe integers. The combined facade/vault/track/admin run passed four files and sixty-four tests; scoped ESLint and TypeScript checks passed. Final facade-only rerun passed thirty tests after the type narrowing. Source review confirmed authentication precedes privileged vault/admin calls, token reservation precedes canary verification, unsuccessful verification consumes the reserved token, and malformed service replies fail closed with opaque errors. Telemetry validates its allowed event/path before privileged ingestion. The private facade exposes no raw service client; its SDK auth persistence, refresh and URL detection are disabled, and RPC fetch cancellation is bounded to ten seconds. SQL review checked schema-qualified functions, empty search paths, role grants, per-user serialization and token ownership/expiry/replay handling. These are source and mocked-boundary conclusions; this reviewer did not execute the PostgreSQL fixture or prove deployment behavior. Residual: the configured Supabase secret still carries underlying service-role authority despite the narrow application facade. Independent review also identified concurrent first-canary overwrite in the pre-existing initialization path; root owns its separately recorded conditional initialization remediation and regression proof.

### First-unlock concurrent initialization batch (owner-authorized)

Scope: `src/app/api/vault/route.ts`, `test/api/vault.test.ts`. A stale null-canary read currently permits an unconditional upsert to replace another request's canary and profile email. Use the existing user-session client to insert a missing profile with conflict-ignore, conditionally update only a null canary, then reread and verify the winner before finishing the attempt or issuing a cookie. Preserve existing metadata. Acceptance: deterministic concurrent different-key regression fails before the fix, one winner succeeds and loser records failure without a cookie; existing profile metadata and error paths are covered; targeted tests, lint and typecheck pass. Rollback: revert this bounded route/test change. No dependencies, SQL migration, privileged financial client or secret access.

First-unlock batch verification: deterministic two-request stale-read regression returned `[200, 200]` before remediation and `[200, 401]` after, with exactly one cookie, a failed loser attempt finish, and existing email preserved. Missing-profile initialization and insert/update/winner-read failures are covered; failures emit no cookie and never finish an attempt as successful. Vault suite: 17 passing tests. Scoped ESLint and project TypeScript pass. The conditional update uses the authenticated user-session client; profile column/RLS direct-access residual remains unchanged. Source/test snapshot is stable for global gates.

Portable fixture final proof: a fresh PG17.10 cluster successfully replayed all nine relevant nondestructive histories and both forward migrations, ran both real-role SQL suites, both actual preflight conflict branches, three observed-lock household races and six simultaneous first-row service-role vault admissions yielding exactly five distinct tokens. Abandoned reservations charged five failures and denied admission; elapsed15-minute windows recovered; consumed/expired token replay failed without resetting counters; successful completion preserved later pending failures; expiry charged on subsequent admission. PostgreSQL stopped in finally and its pid file was absent; fixture logs/data retained at the owner-scoped visualization directory `fynfo-security-portable-05`. The runner required supported spawn escalation after sandbox EPERM; no secret reads or network connections beyond localhost. Two earlier harness defects (Windows detached pg_ctl pipe retention and JavaScript replacement-string dollar escaping) were independently reproduced and corrected before the final successful fresh run. Scoped Node syntax, ESLint and formatting checks pass.

Final project verification: pnpm check passed route logging, formatting, lint and TypeScript. pnpm test:ci passed 105 files / 780 tests with 91.64% lines, 91.45% statements, 88.82% functions and 85.36% branches; unchanged whole-source coverage and security-specific floors pass. Isolated fixture-only Next16.3.8 webpack production build passed, generated 17 static pages, and supported standalone server passed eight public HTTP checks including CSP/nosniff before shutdown. git diff --check passed. Harness retains the same two existing drifted paths (approved AGENTS amendment and pre-existing next-verify skill drift); enforcement baseline was not modified. No production migration or real credential access occurred.

Integration authorization (2026-10-08): Clarence explicitly requested a pull request and merge, reserving Supabase migration execution for himself. Merge is authorized after green GitHub CI. No production database migration, deployment, credential read or harness baseline update is included.
