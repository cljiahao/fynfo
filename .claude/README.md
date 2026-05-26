# .claude/ — Fynfo Agent Harness

Configuration that Claude Code (and compatible harnesses) load on session start.

## Files

- `settings.json` — permissions allowlist/denylist + hook registration.
- `harness.json` — SHA-256 manifest of seeded harness files (used by `templatecentral:standards` drift detection).
- `hooks/guard-protected-paths.ps1` — blocks Write/Edit against constitutional, governance, secret, and infra-publish files.
- `hooks/guard-destructive-bash.ps1` — blocks force pushes, hard resets, branch deletion, docker push, destructive SQL, `.env` overwrites.
- `skills/` — Fynfo project-scoped skills (templateCentral v4). `skills/next-verify.md` runs the §3 quality gates in one pass; `skills/regen-harness.md` recomputes `harness.json` after seeded-file edits. See `AGENTS.md` §9 for the skill scoping priority.

## Hook behavior

| Event            | Action                                                              |
| ---------------- | ------------------------------------------------------------------- |
| SessionStart     | Prints governance reminder banner.                                  |
| UserPromptSubmit | Warns if `specs/` missing.                                          |
| PreToolUse Write | Guard against editing governance/secret files.                      |
| PreToolUse Bash  | Guard against destructive commands.                                 |
| Stop             | Reminds: gates green? spec linked? sections cited? scope respected? |

## Amendments

`settings.json`, `harness.json`, `hooks/**`, and `skills/**` are protected per `CONSTITUTION.md` §8.2. Changes require a `specs/governance/` amendment (the templateCentral v4 alignment of 2026-05-27 is covered by the standing exemption in `AGENTS.md` §0.3).

## Cross-platform note

Hooks are PowerShell because the dev host is Windows. CI runs the gates directly (`pnpm check`, `pnpm test:ci`, `pnpm build`) — it does not need these hooks. If a teammate runs on macOS/Linux, port to `.sh` and gate by `$OS` in `settings.json`.
