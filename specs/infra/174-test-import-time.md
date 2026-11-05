---
id: '174'
slug: test-import-time
area: infra
status: shipped # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-05
approved: 2026-11-05
shipped: 2026-11-05
impl_pr: 6367cc4
supersedes:
constitution_satisfies:
  - '§2.6'
  - '§3.2'
  - '§4.1'
  - '§4.3'
  - '§4.4'
constitution_overrides:
---

# Spec 174: Reduce test import time (vitest optimizer, date-fns subpaths, lint guard)

## Problem

Spec 173 split the test run into four shards, but each shard is still slow
because the import (collect) phase dominates. On shard 1/4 (59 files, vitest
4.1.12, no coverage) the baseline is: import 67 s, jsdom environment setup 21 s,
tests 24 s, wall 62 s, with under 1% run-to-run noise. Coverage is not the
cause (coverage on adds 5% to import). Per-module self time shows four heavy
third-party barrels account for about 46 s of the 64 s of self import time, and
every test file pays them again because each file runs in a fresh module graph:

| Module              | Cumulative self time | Files importing |
| ------------------- | -------------------- | --------------- |
| `date-fns` (barrel) | 18.7 s               | 18              |
| `react-day-picker`  | 12.7 s               | 9               |
| `radix-ui` (barrel) | 10.5 s               | 25              |
| `recharts`          | 4.1 s                | 14              |

Project source barrels (`@/features/*` index files) sum to well under 1 s, so
they are not the problem. Node-env files such as
`test/features/financial-vault-guards.test.ts` (5.0 s import) are slow only
because server actions transitively import `date-fns`.

Measured experiments on shard 1/4 (two runs each):

| Experiment                                         | Import       | Wall    |
| -------------------------------------------------- | ------------ | ------- |
| Baseline                                           | 67.0 s       | 62 s    |
| `test.deps.optimizer.ssr` enabled (config only)    | 55.1 s, -18% | 56-57 s |
| `date-fns` subpath imports in 21 source files only | 57.4 s, -14% | 58 s    |
| Optimizer plus subpath imports                     | 49.5 s, -26% | 53 s    |

The subpath change alone saves less (-14%) because `react-day-picker` itself
imports the `date-fns` barrel, so part of the cost moves rather than vanishes;
the optimizer pre-bundles `react-day-picker` and removes that cost, which is why
the two stack. The evidence report and the 21-file rewrite patch were produced
outside the repo during spec 173 Part 4 measurement; the patch is applied by the
implementer, not stored in the repo.

## Constitution check

- Satisfies: `§4.1` (gates stay green; this makes them faster to run), `§4.4`
  (`pnpm build` must remain green), `§4.3` (no `eslint-disable` or `@ts-ignore`
  is added), `§3.2` (no `any`, no `console.log`), `§2.6` (the new lint rule is
  merged into the existing `no-restricted-imports` entry, so the feature-barrel
  rule keeps working).
- Overrides: none. No `HARD` rule is touched, and no `SOFT` rule is overridden.
  `§4.2` coverage floors and the vitest coverage thresholds are unchanged.
- Governance: `eslint.config.mjs` and `vitest.config.ts` are not permission
  protected files under `AGENTS.md` §0.3 or `CONSTITUTION.md` §8.2. No new
  dependency is added (`AGENTS.md` §0.4). `date-fns` 4.1.0 already exposes the
  `date-fns/<fn>` subpath entry points.
- Authority: owner approved this scope on 2026-11-05; this spec follows the
  spec-first path of `AGENTS.md` §1.2, not the §7.4 audit path.

## Solution shape

Three changes, applied together.

1. **Vitest dependency optimizer** in `vitest.config.ts`: enable
   `test.deps.optimizer.ssr` with `enabled: true` and an `include` list of the
   six packages measured: `date-fns`, `react-day-picker`, `radix-ui`,
   `recharts`, `lucide-react`, `@testing-library/react`. Confirm the exact key
   shape against the installed vitest 4.1.12 types before writing it. Config
   only; no source change for this part.
2. **date-fns subpath imports.** Replace barrel imports
   (`import { format } from 'date-fns'`) with per-function subpaths
   (`import { format } from 'date-fns/format'`) in the 21 source files below
   (28 import lines in the measured patch). Behavior is unchanged; only module
   resolution differs.
   - `src/features/admin/components/marketing-trend-chart-content.tsx`
   - `src/features/assets/hooks/use-snapshot-editor.ts`
   - `src/features/equity/components/dividend-form.tsx`
   - `src/features/equity/components/dividend-table.tsx`
   - `src/features/equity/components/trade-table.tsx`
   - `src/features/equity/lib/trade-form-defaults.ts`
   - `src/features/expenses/components/editable-expense-row.tsx`
   - `src/features/expenses/components/expense-quick-add.tsx`
   - `src/features/expenses/components/expense-table.tsx`
   - `src/features/expenses/components/quick-add-date-field.tsx`
   - `src/features/expenses/lib/owed.ts`
   - `src/features/household/components/add-contribution-dialog.tsx`
   - `src/features/household/components/goal-card.tsx`
   - `src/features/household/components/goal-contributions-chart-content.tsx`
   - `src/features/household/components/goal-detail.tsx`
   - `src/features/household/components/goal-item-list.tsx`
   - `src/features/household/components/shared-spending.tsx`
   - `src/features/household/lib/goal-stats.ts`
   - `src/features/review/components/monthly-review.tsx`
   - `src/features/salary/components/salary-form.tsx`
   - `src/lib/utils/month.ts`
3. **Regression guard** in `eslint.config.mjs`: in the existing
   `src/**/*.{ts,tsx}` block, add an exact-path entry to the
   `no-restricted-imports` option object, for example
   `paths: [{ name: 'date-fns', message: 'Import from a subpath such as date-fns/format to keep test and bundle import cost low.' }]`,
   alongside the existing `patterns` entry (flat config replaces a rule's
   options wholesale, so both must live in the one entry). `paths` matches only
   the bare specifier, so `date-fns/format` stays allowed. Verify manually that
   a bare `from 'date-fns'` fails lint.

Test files (`test/**`) are covered by the same rule (owner answer to Q1): a
second `eslint.config.mjs` block applies the `paths` restriction to
`test/**/*.{ts,tsx}`, and the four test files that import the barrel are
converted. Encryption-touching paths: none. Data
model: none. No new components, hooks or actions.

## Out of scope

- Lazy-loading or isolating the calendar (`react-day-picker`) and `recharts`
  consumers behind dynamic imports. Estimated a further 8 to 12 s per shard
  (derived, not measured), but it is a component refactor with client-boundary
  implications and is deferred to a future spec.
- Reducing jsdom environment setup (about 21 s per shard, 800 ms per DOM file).
  No tested option changed it; `happy-dom` would need a new dependency.
- Rejected alternatives: `--no-isolate` (largest saving, import -35 to -54%, but
  tests fail from shared mock and module state); `--pool=threads` (-5%, changes
  isolation semantics); `experimental.fsModuleCache` (noisy, 0 to -6%).
- No new dependency, no coverage threshold change, no change to shard scripts,
  hooks, CI workflows or any protected file.

## Acceptance

- [x] `pnpm format:check` green
- [x] `pnpm lint` green (max-warnings=0); adding a bare `import { format } from 'date-fns'` under `src/` makes lint fail, and `date-fns/format` passes
- [x] `pnpm typecheck` green
- [x] `pnpm test:ci` green with unchanged coverage thresholds; any `vi.mock('date-fns')` must follow the new subpath and is noted in the PR
- [x] `pnpm build` green
- [x] No bare `date-fns` imports remain in `src/` or `test/` (`grep` returns none); a bare import under `test/` also fails lint
- [x] Before/after import (collect) time and wall time recorded for all four shards (`pnpm test:shard 1/4` to `4/4`), same idle host, two runs each, in the PR body; shard 1 import time expected near 49.5 s from 67 s
- [x] Manual: the date picker, quick-add date field and household charts render and format dates as before (owner-verified 2026-11-05)
- [x] Spec hash matches at impl PR time

## Results

Measured with `vitest run --shard N/4` (no coverage), seconds. The host is
shared with other vitest runs, so rows marked contended are not comparable.

| Shard | Before wall / import | After wall / import | Note                                                  |
| ----- | -------------------- | ------------------- | ----------------------------------------------------- |
| 1/4   | 77.5 / 86.3          | 60.9 / 58.7         | both quiet; import -32%                               |
| 2/4   | 146.4 / 138.6        | 74.0 / 63.3         | before contended (another run active); not comparable |
| 3/4   | 181.7 / 191.1        | 80.4 / 74.8         | before contended; not comparable                      |
| 4/4   | 73.6 / 77.0          | 70.1 / 63.0         | both quiet; import -18%                               |

Only one run per shard was taken after the host became contended; the quiet
shards 1 and 4 show the effect. All shards pass (586, 732, 515, 689 tests).

## Risk & reversibility

- **Blast radius**: test tooling plus 21 source files, mechanical import
  rewrites. `date-fns/<fn>` resolves to the same function implementations.
  Runtime and bundle behavior should be identical or slightly smaller. The main
  risk is the optimizer changing mock behavior: `vi.mock` of radix, date-fns or
  other pre-bundled packages may stop intercepting, which a full-suite run
  catches.
- **Reversibility**: a single `git revert` of the impl commit; no data or
  migration involved.
- **Backout plan**: if the optimizer causes failures that cannot be fixed by
  trimming its `include` list, drop that block and ship the subpath imports and
  lint rule alone (-14%).

## Open questions

- [x] Q: Should `test/**` files also be forbidden from bare `date-fns` imports? — Owner: Clarence — A: Yes (2026-11-05); the lint rule covers `test/**`.
- [x] Q: Is the `test.deps.optimizer.ssr` key shape valid in vitest 4.1.12 as measured? — Owner: implementer, resolved before first edit — A: Yes. vitest 4.1.12 types declare `deps.optimizer?: Partial<Record<'client' | 'ssr' | string, DepsOptimizationOptions>>`, so `test.deps.optimizer.ssr: { enabled: true, include: [...] }` is valid.
