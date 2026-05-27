id: 003
slug: stop-hook-simplification
area: governance
status: shipped
author: clarence + claude (opus 4.7, 2026-05-27)
created: 2026-05-27
approved: 2026-05-27
shipped: 2026-05-27
impl_pr:
supersedes:
constitution_satisfies: - '§8.2' # protected harness file edit, recorded post-hoc - '§Tooling' # remove broken hook commands
constitution_overrides: - section: '§1.2'
reason: 'Sole-owner manual edit to `.claude/settings.json` shipped before this spec; recorded post-hoc for audit
trail. No agent self-write granted.'

---

# Spec 003: Stop hook simplified, PostToolUse removed

## Problem

Two hook commands in `.claude/settings.json` used inline PowerShell with `$VAR` references. The Claude Code harness
wraps hook commands through a bash layer on this Windows host; bash expands `$out`, `$ec`, `$LASTEXITCODE` to empty
strings before PowerShell parses the body. The mangled string then fails the PowerShell parser:

`$out = & pnpm test:ci 2>&1; $ec = $LASTEXITCODE; ...`

becomes

` = & pnpm test:ci 2>&1;  = ;  | Select-Object -Last 20 | ...`

which PowerShell rejects with `The ampersand (&) character is not allowed` and `An empty pipe element is not allowed`.
Stop hook errored every turn end. PostToolUse (`pnpm format:check` variant of the same anti-pattern) was silently
broken (PostToolUse failures swallowed by harness).

## Constitution check

- Satisfies: §8.2 — manual owner edit to a protected harness file, recorded post-hoc for trail.
- Overrides: §1.2 spec-first ordering — fix shipped before spec by sole owner. No future precedent: future
  protected-file edits go through `governance/` spec first.

## Solution shape

- Stop hook: command replaced with a single-line `Write-Output` reminder echoing AGENTS §11 row 5 intent. No `$VAR`,
  no `&` subprocess invocation. Bash wrapper has nothing to expand.
- PostToolUse hook: removed entirely. CI gates (`pnpm check`) plus the Stop reminder cover the same surface; the hook
  ran `pnpm format:check` on every Write/Edit which is redundant and was already broken.
- No new script files. No perm widening. No agent self-write to harness config.
- Working hooks untouched: SessionStart banner, UserPromptSubmit specs/ warning, PreToolUse Write/Edit + Bash guards,
  PostCompact reminder.

## Out of scope

- Restoring an automated test runner at turn end. AGENTS §11 row 5 satisfied by the reminder text; users run
  `/next-verify` (or `pnpm check && pnpm test:ci && pnpm build`) before commit. CI is the authoritative gate.
- Other PowerShell hooks: none use inline `$VAR` patterns.

## Acceptance

- [x] `.claude/settings.json` Stop hook `command` contains no `$VAR` and no `&` subprocess invocation.
- [x] `.claude/settings.json` `PostToolUse` block absent.
- [x] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` green.
- [x] No `.claude/settings.local.json` created.
- [x] Stop hook fires without PowerShell parser errors on next turn end.

## Risk & reversibility

- **Blast radius**: harness hooks only. No runtime code path touched.
- **Reversibility**: single `git revert` of the impl commit restores prior (broken) blocks.
- **Backout plan**: revert.

## Open questions

- [ ] Reintroduce typecheck-only Stop hook later as `.claude/hooks/stop-typecheck.ps1` (separate file, no inline
      `$VAR`)? Defer; current reminder text sufficient.
