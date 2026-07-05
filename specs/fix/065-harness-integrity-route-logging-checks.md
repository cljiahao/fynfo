---
id: 065
slug: harness-integrity-route-logging-checks
area: fix
status: shipped
author: Claude (Opus 4.8)
created: 2026-07-05
approved: 2026-07-05
shipped: 2026-07-05
impl_pr: (direct to main)
supersedes:
constitution_satisfies:
  - '§1.1'
constitution_overrides:
---

# Spec 065: Harness-integrity + route-logging gate checks

## Problem

Two guarantees the repo currently relies on by convention, not by construction —
both cheap to make mechanical, both cherry-picked from templateCentral 5.2 / 5.7:

1. **Harness integrity is unverified.** `.claude/harness.json` records SHA-256
   hashes of every seeded enforcement file (rulebooks, `settings.json`, hooks,
   skills), but nothing recomputes them. A silent edit to the enforcement layer
   drifts from the manifest undetected until a human happens to run
   `templatecentral:standards`.
2. **Route logging is unenforced.** `AGENTS.md` §4 requires every API handler to
   be wrapped by `withLogging`. True today (4/4 routes) but only by habit — a new
   raw `export async function GET` would ship unlogged.

Neither touches the enforcement layer at write-time: both are plain **read-only
validator scripts**. They live in `scripts/` (agent-editable; not `.claude/**`,
not CI YAML, not `build-push.sh`) and hang off the existing `pnpm check` gate,
which husky pre-commit and `.github/workflows/ci.yml` already invoke. So they
gain CI + pre-commit coverage with **no edit to any human-only file**.

## Constitution check

- Satisfies: `§1.1` (self-hosted single-user integrity — the enforcement layer
  is the trust boundary; drift detection protects it).
- Respects `§8.2`: no enforcement-layer file is modified. The scripts only
  _read_ `harness.json` and route sources. Re-blessing the baseline stays a
  human action (`/regen-harness`); these scripts merely fail the build when
  reality diverges from the last human-blessed manifest.
- Overrides: none.

## Solution shape

- `scripts/verify-harness.mjs` — recompute SHA-256 of each `seeded_files` entry
  in `.claude/harness.json`, compare to `origin_hash`, exit 1 on any drift or
  missing file. Hashing matches `/regen-harness` byte-for-byte.
- `scripts/check-route-logging.mjs` — walk `src/app/api/**/route.ts`, exit 1 if
  any exported HTTP method handler is assigned a function other than
  `withLogging(...)` or is a raw `export function GET` etc.
- `package.json` `check` script — prepend both validators (fail-fast, before the
  slower format/lint/typecheck):
  `node scripts/verify-harness.mjs && node scripts/check-route-logging.mjs && pnpm format:check && pnpm lint && pnpm typecheck`

Both are Node `.mjs` (cross-platform, no new dependency — Node stdlib only).

## Why wire into `check` and not `.github/` or `.claude/`

CI runs `pnpm check`; husky pre-commit runs `pnpm check`. Editing the `check`
script (agent-editable `package.json`) propagates both validators to CI and
pre-commit automatically — so no edit to `ci.yml` (human-only `.github/**`) or
any `.claude/**` file is required. This is the whole reason it's agent-landable.

Consequence, intended: after a legitimate enforcement/rulebook edit, `pnpm check`
fails until a human runs `/regen-harness`. That coincides with the §8.2 human
approval step for such edits, so it adds no new friction — it _is_ the guard.

## Known limitation (post-ship, CI-discovered)

`verify-harness.mjs` was initially wired into `pnpm check` but broke CI: it hashed
raw bytes, and `harness.json`'s hashes were regenerated on a **CRLF** Windows
working copy while git stores + CI checks out **LF** — so AGENTS.md and
`next-verify/SKILL.md` mis-hashed on Linux. **Backed out of the gate**;
`check` now runs `check:routes` only. The verifier now normalizes CRLF→LF before
hashing (cross-platform), and stays runnable manually via `pnpm check:harness`.

To **re-enable it in the gate** (all human-only enforcement steps):

1. Update the `regen-harness` skill to hash LF-normalized bytes (match the script).
2. Run `/regen-harness` so `harness.json` holds normalized hashes.
3. Re-add `pnpm check:harness &&` to the front of the `check` script.

## Out of scope

- Installing `verify-harness.mjs` as a `.claude/hooks/` lifecycle hook — human-only.
- Bumping `templatecentral_version` past `5.0.0` — this is a cherry-pick, not a
  full 5.7 harness adoption; the version stays honest.
- skill-capture / lefthook (tc 5.2/5.4 extras) — not adopted.

## Acceptance

- [ ] `node scripts/verify-harness.mjs` prints `OK (11 files match manifest)`, exit 0
- [ ] `node scripts/check-route-logging.mjs` prints `OK (4 route file(s) all wrapped)`, exit 0
- [ ] `pnpm check` green (both validators run first)
- [ ] `pnpm test:ci` green
- [ ] `pnpm build` green
- [ ] No file under `.claude/**`, `.github/**`, or any secret touched

## Risk & reversibility

- **Blast radius**: two new scripts + one `package.json` line. No app/data/crypto.
- **Failure mode**: a false-positive would block commits. Mitigated — both
  validate clean against the current repo before commit.
- **Reversibility**: single `git revert` (remove scripts + restore `check` line).

## Open questions

- none.
