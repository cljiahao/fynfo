---
id: 010
slug: harness-4.2.0-alignment
area: governance
status: shipped
author: clarence + claude (opus 4.8, 2026-05-30)
created: 2026-05-30
approved: 2026-05-30
shipped: 2026-05-31
impl_pr: e43ed08 (direct to main, solo project)
supersedes: 003 (Stop hook — restores test enforcement that 003 removed)
constitution_satisfies:
  - '§7.1'
  - '§8.2'
constitution_overrides: []
---

# Spec 010: templateCentral 4.2.0 harness alignment

## Problem

Fynfo''s harness was seeded at templateCentral 4.0.0 (`.claude/harness.json`). The plugin is now at 4.2.0, which added harness-engineering best practices Fynfo lacks, plus the 4.1.0 OWASP-LLM01 firewall:

1. The `Stop` hook is reminder-text only (always exits 0). Spec 003 removed the test-enforcing Stop hook because the old command errored every turn end on this Windows host. The canonical 4.2.0 Stop hook runs the suite, writes output to stderr, and `exit 2` on failure so a red turn cannot end silently.
2. No prompt-injection firewall. 4.1.0 added a `UserPromptSubmit` handler (OWASP LLM01) blocking obvious injection phrases. Given Fynfo''s zero-knowledge vault (DEK cookie + `SESSION_SECRET`), an injected prompt is a real exfiltration vector.
3. `guard-protected-paths.ps1` blocks `.env*` and governance files but not `.github/workflows/`, cert files, or credential files — 4.2.0 expanded PreToolUse to cover these.
4. Minor: no `skillListingBudgetFraction` (30+ skills load per session), no `.agents` symlink, AGENTS.md §11 lacks the 4.2.0 context-load-order note, `harness.json` version + hashes stale.

## Constitution check

- Satisfies: §7.1 — governance amendment to protected harness files via spec-first flow. §8.2 — protected `.claude/**` + `AGENTS.md` edits recorded in advance.
- Overrides: none. Supersedes 003 on the Stop hook only; 003''s lesson (no inline `$VAR`, external `.ps1`) is honored.

## Solution shape

All hooks remain PowerShell external `.ps1` (Windows dev host — load-bearing deviation per AGENTS §11; do not port to node/bash).

- New `.claude/hooks/stop-tests.ps1` — runs `pnpm test:ci`, captures exit code, writes tail to stderr, `exit 2` on failure else `exit 0`. Invoked via `-File`. Heeds 003''s failure mode.
- New `.claude/hooks/injection-guard.ps1` — UserPromptSubmit handler; reads prompt from stdin JSON, matches a minimal deny list, writes reason to stderr + `exit 2` on match else `exit 0`.
- `.claude/settings.json` — (a) replace reminder-only `Stop` command with `-File .claude/hooks/stop-tests.ps1` plus keep a reminder handler; (b) add a second `UserPromptSubmit` handler invoking `injection-guard.ps1`; (c) add `"skillListingBudgetFraction": 0.02`.
- `.claude/hooks/guard-protected-paths.ps1` — extend `$protected` with `.github/workflows/`, cert extensions (`.pem`/`.key`/`.p12`/`.pfx`/`.secret`), credential filenames (`credentials.json`/`.netrc`/`.secrets`). Governance protections unchanged.
- `AGENTS.md` §11 — append 4.2.0 context-load-order note; add Stop + UserPromptSubmit injection rows. §12 — one line recording 010.
- `.agents` → `.claude` symlink (best-effort; Windows needs Developer Mode/admin — skip with a note if it fails).
- `.claude/harness.json` — bump `templatecentral_version` to `4.2.0`, add the two new `.ps1`, regen all hashes.
- `/regen-harness` skill — add the two new hook paths.

## Out of scope

- Porting hooks to node/bash. Relaxing any governance protection. `FUTURE.md`, `next-migrate`, `verify.sh` (per 008). Supabase/auth/encryption runtime code.

## Acceptance

- [x] `stop-tests.ps1` runs `pnpm test:ci`, stderr, exit 2 on fail / 0 on pass; no inline `$VAR`.
- [x] `injection-guard.ps1` blocks a known injection phrase (exit 2), passes a normal prompt (exit 0).
- [x] `settings.json` has new Stop command, injection handler, `skillListingBudgetFraction: 0.02`.
- [x] `guard-protected-paths.ps1` blocks `.github/workflows/ci.yml`, `x.pem`, `credentials.json`; still allows app code.
- [x] `AGENTS.md` §11 updated; §12 has the 010 note.
- [x] `harness.json` version `4.2.0`, lists both new hooks, hashes match disk.
- [x] `.agents` symlink created OR skip documented.
- [x] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` green.
- [x] Spec hash: n/a — direct-to-main, no PR hash gate.

## Risk & reversibility

- **Blast radius**: harness layer + AGENTS.md docs only. No runtime/schema/auth/encryption path. Stop hook gains blocking power (exit 2) — risk is false-block if `pnpm test:ci` errors for non-test reasons; mitigated by external-`.ps1`/exit-code capture and a manual smoke.
- **Reversibility**: single `git revert`; `harness.json` regen mechanical.
- **Backout plan**: revert commit, rerun `/regen-harness`.

## Open questions

- [x] Q: Stop on full `pnpm test:ci` vs faster subset each turn? — Owner: Clarence — A: start with `test:ci`.
- [x] Q: Keep Stop reminder as second handler once tests enforce? — Owner: Clarence — A: keep both for now.
