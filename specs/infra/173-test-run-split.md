---
id: '173'
slug: test-run-split
area: infra
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-04
approved: 2026-11-05
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  - '§4.1'
  - '§4.2'
  - '§4.4'
  - '§7.4'
constitution_overrides:
---

# Spec 173: Split the test run into shards and lighten pre-push

## Problem

A full `pnpm test:ci` takes about 20 minutes on the dev host, and the pre-push
hook (`.husky/pre-push`: `pnpm build && pnpm run check && pnpm run test:ci`)
adds a build and the check suite on top, roughly 30 minutes per push (the
build and check durations are an estimate, not measured). Agent foreground
commands are capped at 10 minutes, so a full run has to be backgrounded and is
lost when the session ends; this has already killed landing runs. Under load
two tests also hit the 5 s default timeout although they pass alone, so a
slow host produces red pushes that are not regressions.

Measured facts, verified against the repo:

- `test:ci` is `vitest run --coverage`; `vitest.config.ts` sets
  `maxWorkers: 2` (four workers caused DOM-test timeouts, spec 082), global
  coverage floors of 81% plus per-file floors, and
  `reportsDirectory: process.env.VITEST_COVERAGE_DIR ?? 'coverage'`.
- The last full run took 1205.69 s wall time. Vitest's cumulative phase totals
  were import 1126.77 s, tests 487.31 s, environment 428.73 s. These sum
  across workers, so they exceed wall time; import is the largest share.
- Flaky tests, both passing when run alone:
  - `test/features/assets/snapshot-conflicts.test.tsx`, "submits the draft
    baseline rather than a refetched identity/revision": typed 123, submitted 100. `edit()` calls `fireEvent.change` and the test then goes straight to
    `save()` without waiting for the input value to settle.
  - `test/features/profile/statement-import.test.tsx`: the exact failing test
    is not recorded; the file has many multi-step `fireEvent` flows, so the
    failing test name must be captured from a failing run before fixing.
- CI (`.github/workflows/ci.yml`) already runs `pnpm check`, `pnpm test:ci`
  and `pnpm build` as separate steps, so the pre-push hook duplicates CI.

## Constitution check

- Satisfies: `§4.1` (the `pnpm check` and `pnpm test:ci` gate of record is
  unchanged and still required on every PR), `§4.2` (regression-style tests
  stay meaningful; coverage floors untouched), `§4.4` (`pnpm build` remains a
  required gate in CI and in `/next-verify`), `§7.4` and `AGENTS.md` §1.2
  (spec-first and owner approval for tooling-policy changes).
- Overrides: none. No `HARD` rule is touched. Part 2 changes a local hook
  only; it does not relax the `§4.1` gate, which is enforced on the PR.
- `.husky/pre-push` is not on the `AGENTS.md` §0.3 protected list, but
  lowering what a push verifies is a tooling-policy change and is treated as
  an owner decision here.

## Solution shape

Four independently approvable parts. The owner may approve any subset.

### Part 1: `test:shard` script

- Add to `package.json`: `"test:shard": "vitest run --shard"`, used as
  `pnpm test:shard 1/4` through `4/4`. No coverage flag, so each shard
  avoids the v8 instrumentation cost and fits a foreground run under 10 min
  (target to be confirmed by measurement, see Acceptance).
- Add `"test:shards"` that runs the four shards sequentially, for example
  `vitest run --shard 1/4 && ... 4/4`, written so a failing shard stops the
  chain. Document both in the README testing section.
- `maxWorkers: 2` stays. Shards run one after another, never in parallel on
  the dev host.
- Coverage thresholds are not checked per shard (a shard sees a fraction of
  the tests). The full `pnpm test:ci` with coverage remains the `AGENTS.md`
  §3 and `§4.1` gate of record; shards are a fast confidence tool and a way to
  run the suite inside agent time limits.

### Part 2: Lighten pre-push (OWNER DECISION)

Options:

- **A. Keep as is.** Build, check and the full coverage run, about 30 min per
  push.
- **B. Check plus shards.** `pnpm run check && pnpm test:shards`. Same
  behavioral test coverage as today minus coverage thresholds and the build;
  about 20 min.
- **C. Check only (recommended).** `pnpm run check`, a few minutes. Build and
  the full coverage run are left to CI (`ci.yml` already runs them) and to the
  explicit `/next-verify` gate before merge to `main`.

Trade-off: C lets a failing test or build reach the remote branch before CI
reports it. With a solo, main-direct workflow the owner must run
`/next-verify` (or `pnpm test:ci` and `pnpm build`) before landing on `main`,
or wait for CI, before relying on a deploy (`§6.1`: Vercel deploys `main`).
The change is a one-line edit to `.husky/pre-push`.

### Part 3: De-flake the two tests

- `snapshot-conflicts.test.tsx`: after `fireEvent.change` in `edit()`, await
  the state settling, for example
  `await waitFor(() => expect(amount()).toBe('123'))`, before `save()`. Apply
  in `edit()` so every test in the file benefits.
- `statement-import.test.tsx`: reproduce under load, record the failing test
  name, and await the observable state (value, focus or rendered row) the
  step depends on instead of assuming synchronous settling.
- No timeout bumps, no `retry`, no change to `maxWorkers` as the fix.
  Assertions, isolation and coverage are unchanged.

### Part 4: Import-cost investigation (investigation only)

Import is the dominant cumulative phase (1126.77 s). Investigate, without
committing changes in this spec: barrel imports pulling in whole feature
trees (`@/features/*`), heavy third-party imports in tests (for example PDF
and chart libraries), and whether `deps.optimizer` or per-file mocks reduce
it. Output is a short findings note in the PR or a follow-up spec with
measurements; any resulting code change needs its own spec.

## Out of scope

- Any change to `vitest.config.ts`, coverage thresholds, `maxWorkers` or
  `VITEST_COVERAGE_DIR`.
- Changes to `.github/workflows/**`, `.claude/**` hooks or settings, or
  `scripts/build-push.sh`.
- Changing what CI runs, or splitting coverage across shards and merging
  reports.
- New dependencies. Sharding is built into the pinned vitest.
- Committed changes from Part 4.
- Editing governance documents (`AGENTS.md`); README only.

## Acceptance

Part 1:

- [ ] `pnpm test:shard 1/4` through `4/4` each pass and each finishes within
      the 10 min foreground cap on the dev host (record the four timings in
      the impl PR).
- [ ] `pnpm test:shards` runs all four and stops on the first failure.
- [ ] The union of the four shards runs the same test files as `vitest run`
      (compare file counts).
- [ ] `pnpm test:ci` is unchanged and green; README documents the shard
      commands and states that thresholds are not enforced per shard.

Part 2 (only the chosen option):

- [ ] `.husky/pre-push` matches the approved option; a push runs it end to
      end.
- [ ] The README states which gates a push no longer runs and where they run
      instead.

Part 3:

- [ ] The two files pass 10 consecutive runs while a second vitest process
      loads the host (or with `--maxWorkers=4`), with no timeout increases in
      the diff.
- [ ] `pnpm test:ci` green; coverage floors unchanged.

Part 4:

- [ ] A findings note with before/after import timings for each experiment
      and no committed source change.

All parts:

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` green
- [ ] No new dependency; no file outside the approved parts
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: developer tooling and two test files only. No runtime,
  data or encryption path. The largest risk is Part 2: a weaker pre-push can
  let a red test or build reach `main` and Vercel (`§6.1`) before CI catches
  it.
- **Coverage blind spot**: shards do not enforce thresholds, so coverage
  regressions are only caught by the full `test:ci`. Mitigation: the full run
  stays the gate of record in CI and `/next-verify`.
- **Shard imbalance**: `--shard` splits by file, so one shard may be slower.
  Mitigation: measure in the impl PR; the shard count can change from 4
  without changing the design.
- **Flake fix may be incomplete**: a settle-wait removes the observed race but
  the `statement-import` cause is not yet identified. Mitigation: record the
  failing test and rerun under load before declaring it fixed.
- **Reversibility**: every part is a plain `git revert`.
- **Backout plan**: Part 1 revert removes the two scripts; Part 2 restore the
  previous `.husky/pre-push` line; Part 3 revert the test edits.

## Open questions

- [x] Q: Which pre-push option (A, B or C)? — Owner: Clarence — A: C — owner, 2026-11-05: 'Approve, option C'
- [x] Q: Is 4 the right shard count, or should it follow measured timings? —
      Owner: Clarence — A: 4 by default; adjust from measured timings
- [ ] Q: Should the shard commands also be added to a governance document such
      as `AGENTS.md` (needs a `governance/` spec) or stay README-only? —
      Owner: Clarence — A:
