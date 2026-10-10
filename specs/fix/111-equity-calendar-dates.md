---
id: 111
slug: equity-calendar-dates
area: fix
status: draft
author: Codex
created: 2026-10-10
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.6'
  - '§3.1'
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§5.1'
  - '§5.2'
  - '§7.4'
constitution_overrides: []
---

# Audit 111: Reject impossible equity calendar dates

## Problem

The trade and distribution server-action schemas accept impossible dates such as
`2026-02-30` because a successful `Date.parse` is not calendar validation. Trade
create/update then silently normalize that input to March 2. Distribution
create/bulk-create/update send the impossible date prefix to a PostgreSQL `DATE`
column, which rejects it after unnecessary guard/encryption/database work. The
problem is inconsistent input validation; no real stored corruption was observed.

Clarence's whole-project audit and sequential roadmap081 request authorize ordinary
reversible remediation under Constitution §7.4. The external preparation draft recorded the next batch for root review; it did not approve an unreviewed feature or SQL change. Root accepted the exact four-path draft SHA-256 `9fa4b120559264338962c41e27609be5448a18302aad5cc674c348de00b9740f` on 2026-10-10. After PR36 merged, root authorized this implementation and two linked ordinary delivery-closeout paths. Branch `impl/111-equity-calendar-dates` starts from merged main `5c19555ddbcf448dfc41cd5f70d3c6a1da4ddb2c`. Keep `approved` blank under the ordinary audit path.

## Constitution check

- Satisfies §2.1/§5.1: encryption and existing payloads remain unchanged.
- Satisfies §2.2/§2.3/§5.2: existing Server Functions, identity-before-vault
  context and RLS remain intact; reject invalid input before requesting context.
- Satisfies §2.6: no public barrel or cross-feature runtime import is introduced.
- Satisfies §3.1: reuse installed Zod4; no dependency change.
- Satisfies §4.1/§4.2/§4.4: actual boundary regressions, independent review and
  all five normal gates/hooks before delivery.
- Satisfies §7.4: record ordinary evidence-backed scope before implementation.
- Overrides: none. No HARD invariant, protected file or migration is changed.

## Evidence and research

Reviewed source at merged `ee6e001957f1bb62a2e64479c00765cfc7e32396` and current
merged `c8714072d1ccd2b5630646439cf7a200bd511fbd`; the relevant equity predicates
and action transformations are unchanged. Source evidence:

- `src/features/equity/schemas.ts:7–12` and `:28–33`: the two date fields use
  the same ISO-shaped regex plus `Date.parse` predicate.
- `actions/equity-actions.ts:57` and `:85`: trade input becomes UTC ISO.
- `actions/dividend-actions.ts:49`, `:70`, `:90`: distribution input becomes
  its first ten characters. Bulk input validates every row before context.
- `src/features/expenses/schemas.ts:5` and `:23–31`: shipped101 already uses
  `z.iso.date()` for the first ten characters while retaining the original
  full-string regex and `Date.parse` check. Its meaningful regression file is
  `test/features/expenses/expense-calendar-dates.test.ts`.
- `supabase/migrations/20260615000000_add_equity_dividends.sql:15`: actual
  distribution storage column is `DATE`. Inspect only; no SQL execution.

External `111-calendar-boundary-reproduction.cjs`/`.json` executed actual copied
schemas and all five action paths with inert synthetic boundary spies. Inputs
`2026-02-30`, `2025-02-29` and `2026-04-31T12:00:00+08:00` were accepted by
both schemas. The February30 action reproduction made five context calls:
trade insert/update attempted `2026-03-02T00:00:00.000Z`; distribution
insert/bulk/update attempted `2026-02-30`. These are attempted payloads, not
production persistence or auth/encryption/DB integration proof.

[TC39 Date.parse](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-date.parse)
distinguishes date-only UTC and offsetless local interpretation and permits
implementation-specific fallback outside its date-time format. Do not claim that
every engine rejects or normalizes February30 identically. Empirical results from
the installed runtime establish this defect.
[PostgreSQL17 invalid date/time input](https://www.postgresql.org/docs/17/datetime-invalid-input.html)
documents rejection of out-of-range calendar fields. No impossible distribution
date is claimed to have persisted in production.

## Solution shape

Four application-batch repository files are recorded before any implementation:

1. `specs/fix/111-equity-calendar-dates.md`: publish this scoped ordinary audit
   record; preserve blank approval and append qualified baseline/results/review.
2. `src/features/equity/schemas.ts`: retain existing `ISO_DATE` expression;
   add private `CALENDAR_DATE = z.iso.date()` and one reusable private date field
   schema with the existing string/regex/error contracts. Its refine requires
   `CALENDAR_DATE.safeParse(value.slice(0, 10)).success` and the existing
   successful full-string `Date.parse`. Reuse that private schema in both date
   fields. Return the original input string without transforms.
3. `test/features/equity/equity-calendar-dates.test.ts`: isolated actual-schema
   and actual-action regression suite; instrument the existing context/encryption
   and fake database boundaries, with no live access. Existing action tests
   continue unchanged and verify real synthetic encryption/read contracts.
4. `README.md`: extend the durable 101 calendar-save sentence to include trade
   and distribution saves, explicitly preserving supported timestamps and
   incumbent timezone/storage behavior. No received-income accuracy claim.

Two additional ordinary documentation paths are recorded before edits, for six paths total: `specs/audit/110-expense-paste-accuracy.md` (shipped metadata/current review paragraph only) and `docs/audit/2026-10-09-roadmap-progress.md` (append exact PR36 delivery plus this linked scope). Preserve 110 historical findings, approvals and residuals. Root verified PR36 merged exact `81696acfd6b16b163e08d5f683f6173e7e38a940` as `5c19555ddbcf448dfc41cd5f70d3c6a1da4ddb2c` at 2026-10-10T15:45:25Z after CI run 38064677924 and Vercel preview success; root subsequently verified public merged-commit Vercel production status is successful, not proof of private workflows. No other closeout files are included.

No action implementation edits are needed: all five validate before obtaining
the existing action context. No new public API, feature, server route, form,
hook, migration, encryption code or SQL constraint is added. A schema internal
reuse avoids copying the date predicate twice; moving the expense 101 schema or
adding a cross-feature shared abstraction is unnecessary for this small batch.

Valid date-only and full timestamp strings retain their existing acceptance
and transformations. For example, `2026-12-31T23:30:00-05:00` remains accepted;
trade action stores `2027-01-01T04:30:00.000Z`, distribution action stores
`2026-12-31`. This difference is an incumbent contract, not a new recommended
financial-date policy. Offsetless valid timestamps retain current runtime
interpretation; the batch does not invent a timezone.

## Out of scope

- Bare year-zero DATE/timestamptz input compatibility remains a separate residual: installed Zod/Date accept it, while PostgreSQL17 ordinary type input rejects it. A valid0001 offset timestamp can normalize to year0000 UTC. No positive-year or serialization-policy restriction is added, and this batch does not claim to reject every DB-incompatible date.
- Shared monthly year-zero/chart resilience, positive-year SQL guards and quarter
  millisecond precision from the wider111 investigation remain separate batches.
- Future-record/YTD semantics, exchange-calendar/timezone policy, payment dates,
  ex-date entitlement, provider currency, nearest-date suggestions and historical
  date repairs remain separate product/data contracts.
- No dependency, SQL/schema/data migration, protected/governance edit, crypto
  protocol change, secret access, auth/provider call or production record read.
- No changes to native form parsing: trade form currently converts its valid
  native date field to ISO before dispatch. The regression claim concerns raw
  Server Function boundary inputs. Normal native date inputs do not offer an
  ordinary browser path for typing February30; do not fake that as browser proof.

## Acceptance

- [x] Publish the reviewed six-path audit scope (four remediation paths plus two linked delivery records) before ordinary implementation.
- [x] Meaningful baseline reds execute against shipped equity source: impossible
      date schema rejection and invalid action rejection-before-context assertions
      fail. Preserve exact corrected fixture hashes; the baseline ran before application edits, so no baseline-source restoration was necessary.
- [x] Both schemas reject `2025-02-29`, `2026-02-30`, `2026-04-31`, impossible
      timestamp prefixes with `Z`/offset, month00/13, malformed/truncated strings
      and valid calendar prefix with an invalid timestamp suffix.
- [x] Leap `2024-02-29`, February28, April30, valid `Z`, `+08:00`, `-05:00`
      and the existing supported offsetless timestamp remain unchanged strings.
      Include year rollover in an offset timestamp to prove no prefix-to-UTC
      calendar comparison accidentally rejects valid inputs.
- [x] Actual create/update trade and create/bulk/update distribution reject
      invalid calendar inputs with opaque `VALIDATION` before context,
      encryption or any DB call. A mixed valid/invalid bulk array makes no
      partial writes; preserve the empty-array no-op.
- [x] Valid actual-action controls retain UTC trade payloads, original-prefix
      distribution payloads, identity filters, normal encryption and both
      single/bulk behavior. Existing action/expense 101 regressions stay green.
- [x] Existing mounted actual equity forms still submit valid date-only inputs;
      backend rejection retains drafts and opaque error feedback. Do not claim
      impossible date selection or real authenticated persistence was browser
      exercised. No layout changed, so broad new screenshots are unnecessary.
- [x] Root waived an additional browser pass because layout/native inputs are unchanged. If future uncertainty requires one, use actual forms with
      fixed fixture values and memory-only mutations: one valid leap date
      create/update and failed save followed by retained draft/retry. Document
      adapters, no provider/production proof, and clean up owned resources.
- [x] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci` and
      `pnpm build` pass in the isolated synthetic fixture, aggregate metrics
      above80% and existing stricter security floors unchanged. Coordinate heavy
      gates with root; keep all normal hooks.
- [x] Fresh independent source/tests/README review passes; exactly six scoped paths
      and unchanged application contracts verified. Record exact SHA/evidence before PR.
- [ ] PR/merge only after required exact-head CI/deployment checks are green;
      record shipped metadata only after actual merge. No whole-roadmap claim.

## Risk & reversibility

- **Blast radius:** the two equity input date fields. Incorrect validation could
  reject valid historical/full timestamps; positive leap/offset/rollover controls
  and unchanged transforms bound that risk. Older already-normalized trade dates
  cannot be reconstructed from this fix and are not rewritten.
- **Reversibility:** one scoped code/tests/README/audit revert; no migration,
  database mutation or ciphertext rekey.
- **Backout plan:** revert only111's committed application batch. Retain evidence
  and previous101 behavior. Do not weaken auth, reset history or bypass hooks.

## Open questions

- Root accepted the exact application contract after 110 delivery and before implementation. The additional two linked delivery records are ordinary documentation closeout only.
- Root selected actual schema/action regressions and existing mounted form tests; no additional browser pass is required because layout and native input handling are unchanged.

## Results and limitations

Scope was recorded before product edits on branch `impl/111-equity-calendar-dates`, based on merged main `5c19555ddbcf448dfc41cd5f70d3c6a1da4ddb2c`. The baseline regression against shipped source produced 20 failures and 17 passing controls: five schema failures and 15 independent rejection-before-context failures across all five actual action entry points. The corrected targeted suite passed 112 tests across five files, including existing action, expense calendar and mounted equity form checks. Logs are retained externally as `111-baseline-red.log` and `111-targeted.log`.

All five gates passed sequentially in the isolated fixture: route checks, formatting, zero-warning ESLint and TypeScript (`111-full-check.log`), coverage (`111-full-test-ci.log`) and the normal Next.js 16.3.8 Turbopack production build (`111-full-build.log`). Coverage passed 142 files and 1,379 tests: 93.08% statements, 89.30% branches, 91.24% functions and 93.62% lines, with every existing stricter floor unchanged. Root and the independent latency reviewer found no scoped blocker in source/tests/README; all six recorded path hashes matched the managed tree and fixture. Only final evidence/prose recording changed after source freeze. Normal commit/push hooks and exact-head CI remain required; no commit, PR or merge is claimed yet. Boundary tests use synthetic inputs and inert action context/encryption/database spies; they do not prove authenticated production persistence. Valid timestamps retain existing UTC trade conversion and original-prefix distribution storage. Year-zero database compatibility, historical normalized values and broader calendar findings remain separate residuals.

README and comments were reviewed: the durable calendar-boundary contract was updated, and the private reusable schema adds no redundant inline narration or commented-out code. The implementation reuses the existing101 validation pattern and installed Zod; no frontend layout work or new skill installation was needed.
