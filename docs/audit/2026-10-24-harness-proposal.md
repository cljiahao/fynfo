# Harness right-sizing proposal — audit 152 (owner applies)

Agents cannot edit `.claude/settings.json` or `.claude/hooks/**`. The guard
and the platform self-modification classifier block it. The drafts below sit
in `docs/audit/harness-152/` so you can review and copy them. Nothing under
`.claude/` changed.

## Intent

- **Hard block (exit 2):** reading, copying or overwriting real `.env*` files
  (`.env.example` stays editable), key and cert files, environment dumps,
  force pushes, hard resets, `git clean -f`, branch deletion, discard-all
  restores, stash drop/clear, `--no-verify`, recursive force deletes
  (including PowerShell `Remove-Item -Recurse -Force`), `docker push`,
  `build-push.sh`, destructive SQL (`DROP`, `TRUNCATE`, an unbounded
  `DELETE`) and remote `supabase db reset/push`.
- **Ask (prompt the owner):** `CLAUDE.md`, `AGENTS.md`, `CONSTITUTION.md`,
  `.claude/**`, `.github/workflows/**`, `scripts/build-push.sh`.
- **Allow:** everything else, through the normal permission flow.

## Changes

| File                                                | Change                                                                                                                                                                                                                                                                          | Finding |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `settings.json`                                     | PreToolUse matcher `Bash` becomes `Bash\|PowerShell`. The PowerShell tool bypasses the destructive guard today.                                                                                                                                                                 | H1      |
| `hooks/guard-destructive-bash.mjs`                  | Handles both shell tools. Adds the PowerShell, force-with-lease, `+refspec`, `rm -fr`, `TRUNCATE`, unbounded `DELETE`, remote `supabase db` and stash-drop forms. Blocks shell reads, copies and overwrites of real env files, and `printenv`/`env`/`Get-ChildItem env:` dumps. | H1, H2  |
| `settings.json` + `hooks/guard-protected-paths.mjs` | Write/Edit of `.claude/**` and the other governance paths moves from silent deny/exit-2 to `permissions.ask`, and the hook returns `permissionDecision: "ask"`. Hard block stays for secrets only.                                                                              | H3      |
| `hooks/guard-protected-paths.mjs`                   | The governance patterns match only paths inside the project. Today any path containing `/.claude/hooks/` is blocked, so the planner could not even save these drafts in its own scratchpad.                                                                                     | H7      |
| `settings.json`                                     | Removes the `Read(node_modules/**)` and `Read(coverage/**)` denies. They stop dependency-source and coverage-report reading during audits, and they protect no secret.                                                                                                          | H4      |
| `hooks/stop-tests.mjs`                              | Skips the run when no `src/`, `test/`, `supabase/` or config files changed. Otherwise runs `vitest run --changed HEAD` without coverage, instead of the full 2148-test coverage suite at every turn end. Pre-push still runs all the gates.                                     | H5      |

`injection-guard.mjs`, `post-edit-tsc.mjs` and `session-banner.mjs` stay as
they are.

## Verification

`node docs/audit/harness-152/test-guards.mjs` runs 106 synthetic hook payloads
(Bash and PowerShell commands, plus Write/Edit paths) against the drafted
guards. They all pass. It reads no real env files: the payloads only contain
the file names.

## Apply (owner)

1. Copy `docs/audit/harness-152/settings.json` to `.claude/settings.json`.
2. Copy `docs/audit/harness-152/hooks/*.mjs` to `.claude/hooks/`.
3. Run `/regen-harness` to refresh `.claude/harness.json`. The templateCentral
   marker update from 5.0.0 to 6.0.4 (audit 152 G2) can go with it, under a
   governance note.
4. Delete `docs/audit/harness-152/` in the same commit, or keep it as the
   record.

Sources: [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
(the `permissionDecision` values, exit 2 semantics and the `Bash|PowerShell`
matcher) and [permissions](https://code.claude.com/docs/en/permissions) (deny
→ ask → allow precedence; `Read` denies cover `cat`/`head`/`sed` but not
arbitrary subprocesses).
