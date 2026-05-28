---
id: 008
slug: harness-postedit-tsc
area: governance
status: shipped
author: clarence + claude (opus 4.7, 2026-05-28)
created: 2026-05-28
approved: 2026-05-29
shipped: 2026-05-29
impl_pr:
supersedes: 003 (partially — PostToolUse absence only; Stop simplification holds)
constitution_satisfies:
  - '§7.1'
  - '§8.2'
constitution_overrides: []
---

# Spec 008: PostToolUse `tsc` reintroduction (templateCentral v4 alignment continuation)

## Problem

Fynfo's `.claude/settings.json` omits the v4-canonical `PostToolUse` hook that runs `pnpm exec tsc --noEmit --incremental` after every `Write|Edit`. v4 ships this hook on all four scaffold stacks as the fast-feedback layer between in-session edits and the §3 quality gates. Without it, agents finish a sequence of edits, run `/next-verify` (or wait for CI), and discover broken types late.

Spec 003 (shipped 2026-05-27) removed `PostToolUse` because the prior command used inline PowerShell `$VAR` references that the bash wrapper on this Windows host stripped before PowerShell parsed the line, producing parser errors. 003 left an open question: reintroduce typecheck-only feedback later via a separate `.ps1` file with no inline `$VAR`. This spec answers that question.

§0.3's standing exemption covers the 2026-05-27 templateCentral v4 alignment as a single bounded amendment; that delta is shipped. Adding the PostToolUse hook now is a new harness-config edit that exceeds the exemption, so it goes through this `governance/` spec per §0 hard stop #3 and §7.1.

## Constitution check

- Satisfies: §7.1 — governance amendment to a protected harness file via spec-first flow. §8.2 — protected `.claude/**` edit recorded in advance, not post-hoc.
- Overrides: none. 003's `constitution_overrides` cited §1.2 because that change shipped before the spec was written; this spec is written first.

## Solution shape

- New file `.claude/hooks/post-edit-tsc.ps1` — single-purpose feedback hook. Runs `pnpm exec tsc --noEmit --incremental 2>&1 | Select-Object -Last 5 | Out-Host`. Always exits 0 (feedback-only, never blocks the agent). No `$VAR` references, no `&` subprocess operator, no inline PowerShell — mirrors `guard-protected-paths.ps1` invocation shape.
- `.claude/settings.json` — add a `PostToolUse` entry with matcher `Write|Edit` whose command is `powershell -NoProfile -File .claude/hooks/post-edit-tsc.ps1`. SessionStart, UserPromptSubmit, PreToolUse Write/Edit, PreToolUse Bash, Stop, and PostCompact blocks are unchanged.
- `.claude/harness.json` — regen via `/regen-harness`. Add `.claude/hooks/post-edit-tsc.ps1` to the seeded files list so `templatecentral:standards` drift detection tracks it. Also picks up the legitimate `settings.json` change.
- `AGENTS.md` §11 — add a `PostToolUse` row to the hook table noting the typecheck feedback. §12 — append one line stating spec 008 reintroduces PostToolUse with an external `.ps1` per the 003 lesson.
- `/regen-harness` skill — add the new path to its `files` list so future regens stay accurate.

## Out of scope

- Stop hook behaviour. Spec 003's reminder-text design holds; this spec does not restore an automated test runner at turn end.
- `.claude/skills/next-migrate.md`. Load-bearing deviation per AGENTS §9: Fynfo uses Supabase + raw SQL migrations, not Drizzle. The v4 canonical `next-migrate` skill is Drizzle-specific and intentionally absent.
- `.claude/hooks/verify.sh`. PowerShell host; `/next-verify` already runs the §3 gates in one pass.
- `FUTURE.md`. Optional v4 doc seed, no current value.
- Widening permissions, new deny entries, or any change to the protected-paths / destructive-bash guards.

## Acceptance

- [x] `.claude/hooks/post-edit-tsc.ps1` exists and contains no `$VAR` reference, no `&` subprocess operator, and exits 0 unconditionally.
- [x] `.claude/settings.json` has a `PostToolUse` block with matcher `Write|Edit` invoking the new `.ps1`.
- [x] `.claude/harness.json` lists `.claude/hooks/post-edit-tsc.ps1` and all six `origin_hash` values match the current files on disk.
- [x] `AGENTS.md` §11 hook table includes a `PostToolUse` row; §12 has the spec 008 note.
- [x] `/regen-harness` skill body lists the new `.ps1` path in its `files` array.
- [x] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build` green.
- [ ] Manual: edit a `.ts` file, confirm PostToolUse fires without PowerShell parser error and prints tsc tail to console.
- [ ] Spec hash matches at impl PR time.

## Risk & reversibility

- **Blast radius**: harness hook layer only. No runtime code path, no schema, no auth, no encryption surface touched. Hook is feedback-only (exit 0) so a broken hook cannot block edits.
- **Reversibility**: single `git revert` of the impl commit restores prior state. `harness.json` regen is mechanical.
- **Backout plan**: revert impl commit; rerun `/regen-harness`.

## Open questions

- [ ] Q: Stream tsc output to stderr instead of stdout so harness surfaces it more prominently? — Owner: Clarence — A: defer; v4 canonical uses stdout via `tail -5`, matching that is sufficient.
