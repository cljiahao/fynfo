# Harness PostToolUse tsc Reintroduction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Plan covers a mix of agent-doable and human-only edits; human-only tasks are flagged HUMAN and the executor must stop and surface them rather than retry.

**Goal:** Reintroduce the v4-canonical PostToolUse `tsc --noEmit --incremental` feedback hook for Fynfo, routed through an external `.ps1` per the spec-003 lesson (no inline `$VAR`).

**Architecture:** New external PowerShell hook file invoked by `.claude/settings.json` PostToolUse on `Write|Edit`. Always exits 0; output is a tail of tsc diagnostics. `harness.json` regenerated to track the new file. `AGENTS.md` §11/§12 documents the reintroduction and supersedes the relevant 003 row.

**Tech Stack:** PowerShell 5.1 hook, Claude Code settings.json schema, SHA-256 manifest, pnpm/tsc.

**Spec:** `specs/governance/008-harness-postedit-tsc.md` — must be `status: approved` before any task below T2 runs. T1 may run while spec is `draft` (creates a non-protected file).

---

## Pre-flight

- [ ] **Pre-1: Confirm spec 008 status is `approved`**

Run:

```bash
head -10 specs/governance/008-harness-postedit-tsc.md
```

Expected: `status: approved`. If `draft`, stop and surface to Clarence per AGENTS §1.2.

- [ ] **Pre-2: Confirm working tree clean**

Run:

```bash
git status
```

Expected: nothing to commit (or only the spec change). If unrelated dirty files present, stop.

- [ ] **Pre-3: Branch**

Run:

```bash
git switch -c impl/008-harness-postedit-tsc
```

Expected: switched to new branch.

---

## File Structure

| Path                              | Action                          | Who                          | Why                                                                    |
| --------------------------------- | ------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `.claude/hooks/post-edit-tsc.ps1` | CREATE                          | agent                        | new feedback hook                                                      |
| `.claude/settings.json`           | EDIT (add PostToolUse block)    | HUMAN                        | deny rule `Write/Edit(.claude/settings.json)` + AGENTS §0 hard stop #3 |
| `.claude/skills/regen-harness.md` | EDIT (add path to `files` list) | agent                        | skill file not in deny list                                            |
| `.claude/harness.json`            | REGEN                           | agent (via `/regen-harness`) | mechanical hash update                                                 |
| `AGENTS.md`                       | EDIT §11 + §12                  | HUMAN                        | deny rule `Write/Edit(AGENTS.md)` + AGENTS §0 hard stop #3             |

Human-only tasks ship a verbatim text block the executor must hand to Clarence; executor pauses for confirmation, then verifies the on-disk file contents before proceeding.

---

## Task 1: Create `.claude/hooks/post-edit-tsc.ps1`

**Files:**

- Create: `.claude/hooks/post-edit-tsc.ps1`

- [ ] **Step 1: Write the hook**

Create `.claude/hooks/post-edit-tsc.ps1` with exactly this content:

```powershell
# PostToolUse feedback hook: incremental TypeScript typecheck.
# Reads no input. Always exits 0 (feedback-only, never blocks the agent).
# No $VAR references, no & subprocess operator — see specs/governance/003 + 008.

$ErrorActionPreference = 'SilentlyContinue'

pnpm exec tsc --noEmit --incremental 2>&1 | Select-Object -Last 5 | Out-Host

exit 0
```

- [ ] **Step 2: Verify file written**

Run:

```bash
cat .claude/hooks/post-edit-tsc.ps1
```

Expected: exact content above, 9 non-empty lines.

- [ ] **Step 3: Smoke-test the hook standalone**

Run:

```bash
powershell -NoProfile -File .claude/hooks/post-edit-tsc.ps1; echo "exit=$?"
```

Expected: prints last 5 lines of `tsc` output (or empty if no errors); `exit=0` on the next line. No PowerShell parser error. If tsc fails on existing repo, that is fine — hook is feedback-only, not blocking.

- [ ] **Step 4: Commit**

```bash
git add .claude/hooks/post-edit-tsc.ps1
git commit -m "008: add PostToolUse tsc feedback hook (.ps1)"
```

---

## Task 2: Update `.claude/skills/regen-harness.md`

**Files:**

- Modify: `.claude/skills/regen-harness.md` — extend `files` array

- [ ] **Step 1: Inspect current files list**

Run:

```bash
grep -n "files = " .claude/skills/regen-harness.md
```

Expected: a single line `files = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.claude/skills/next-verify.md', '.claude/skills/regen-harness.md']`.

- [ ] **Step 2: Edit the line**

Replace that single line with:

```python
files = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json',
         '.claude/skills/next-verify.md', '.claude/skills/regen-harness.md',
         '.claude/hooks/post-edit-tsc.ps1']
```

- [ ] **Step 3: Verify edit**

Run:

```bash
grep -A2 "files = " .claude/skills/regen-harness.md
```

Expected: the three-line array including `.claude/hooks/post-edit-tsc.ps1`.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/regen-harness.md
git commit -m "008: track post-edit-tsc.ps1 in regen-harness skill"
```

---

## Task 3 (HUMAN): Edit `.claude/settings.json`

> **HUMAN-ONLY.** Executor must paste the diff for Clarence and STOP. Do not attempt Write/Edit — both are denied for this path. Do not attempt Bash heredoc as a workaround — `.claude/settings.json` is a §0 hard-stop file.

- [ ] **Step 1: Hand Clarence the exact patch**

Insert this block as a new element in `hooks.PostToolUse` (currently absent). It must sit between `PreToolUse` and `Stop`:

```json
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -File .claude/hooks/post-edit-tsc.ps1"
          }
        ]
      }
    ],
```

The surrounding `Stop` and `PostCompact` entries are unchanged. No other field touched.

- [ ] **Step 2: Wait for Clarence to confirm save**

Pause. Resume only after explicit "done".

- [ ] **Step 3: Verify on disk**

Run:

```bash
grep -A8 "PostToolUse" .claude/settings.json
```

Expected: the JSON block above appears once with matcher `Write|Edit`. JSON parses (re-run `cat .claude/settings.json | python -m json.tool > /dev/null` and check exit 0).

- [ ] **Step 4: Smoke-test by editing a throwaway TS file**

Run:

```bash
echo "// touch" >> src/lib/utils/with-logging.ts
```

Then `Edit` it back to its prior state via the agent harness in this session and watch console: the PostToolUse hook should fire (tsc tail printed) without PowerShell parser error.

(If running offline, skip Step 4 and rely on Task 1 Step 3's standalone smoke test.)

- [ ] **Step 5: Commit (Clarence-authored edit, agent commits)**

```bash
git add .claude/settings.json
git commit -m "008: settings.json adds PostToolUse hook entry"
```

---

## Task 4: Regenerate `.claude/harness.json`

**Files:**

- Modify: `.claude/harness.json` (full rewrite via `/regen-harness`)

- [ ] **Step 1: Invoke the project skill**

Run the `/regen-harness` skill (or its inlined Python). If invoking from Bash:

```bash
python - <<'PY'
import hashlib, json, datetime
files = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json',
         '.claude/skills/next-verify.md', '.claude/skills/regen-harness.md',
         '.claude/hooks/post-edit-tsc.ps1']
out = {
    'templatecentral_version': '4.0.0',
    'stack': 'nextjs',
    'seeded_at': datetime.date.today().isoformat(),
    'seeded_files': {},
}
for f in files:
    with open(f, 'rb') as fh:
        h = hashlib.sha256(fh.read()).hexdigest()
    out['seeded_files'][f] = {'origin_hash': h, 'path': f}
with open('.claude/harness.json', 'w') as fh:
    json.dump(out, fh, indent=2)
print('regenerated')
PY
```

Expected: prints `regenerated`. File now lists 6 entries.

- [ ] **Step 2: Verify six entries**

Run:

```bash
python -c "import json; d=json.load(open('.claude/harness.json')); print(len(d['seeded_files']), list(d['seeded_files']))"
```

Expected: `6` followed by the six paths including `.claude/hooks/post-edit-tsc.ps1`.

- [ ] **Step 3: Verify hashes match disk**

Run:

```bash
python - <<'PY'
import hashlib, json
d = json.load(open('.claude/harness.json'))
for path, meta in d['seeded_files'].items():
    h = hashlib.sha256(open(path,'rb').read()).hexdigest()
    assert h == meta['origin_hash'], f'MISMATCH {path}'
print('all match')
PY
```

Expected: `all match`.

- [ ] **Step 4: Commit**

```bash
git add .claude/harness.json
git commit -m "008: regen harness.json (settings.json drift + new .ps1)"
```

---

## Task 5 (HUMAN): Update `AGENTS.md`

> **HUMAN-ONLY.** `Write/Edit(AGENTS.md)` is denied + §0 hard stop #3. Executor pastes diffs, stops, verifies.

- [ ] **Step 1: Hand Clarence the §11 table edit**

In `AGENTS.md` §11 ("AI Harness") table, insert this new row between the `PreToolUse Bash` row and the `Stop` row:

```markdown
| PreToolUse Bash | `guard-destructive-bash.ps1` — blocks force pushes, hard resets, branch deletion, docker push, destructive SQL, `.env` overwrites. |
| PostToolUse Write/Edit| `post-edit-tsc.ps1` — fast incremental typecheck feedback (`pnpm exec tsc --noEmit --incremental`). Feedback-only; exit 0 always. |
| Stop | Reminds: gates green? spec linked? sections cited? scope respected? |
```

(The `PreToolUse Bash` and `Stop` lines are reproduced for context — only the middle line is new.)

- [ ] **Step 2: Hand Clarence the §12 note**

Append this line at the end of `AGENTS.md` §12 ("Project Notes"):

```markdown
**Spec 008 — PostToolUse reintroduction (2026-05-28)**: typecheck-only `PostToolUse` hook reintroduced via external `.claude/hooks/post-edit-tsc.ps1` per the spec-003 lesson (no inline `$VAR`, no `&`). Supersedes spec 003 only on the "PostToolUse absent" decision; 003's Stop simplification still holds.
```

- [ ] **Step 3: Wait for Clarence to confirm save**

Pause. Resume only after explicit "done".

- [ ] **Step 4: Verify on disk**

Run:

```bash
grep -n "PostToolUse Write/Edit" AGENTS.md && grep -n "Spec 008" AGENTS.md
```

Expected: one match each.

- [ ] **Step 5: AGENTS.md changed — regen harness.json again**

The §11/§12 edits changed AGENTS.md's hash; harness.json now drifts. Re-run Task 4 Steps 1–3.

- [ ] **Step 6: Commit AGENTS.md + harness.json together**

```bash
git add AGENTS.md .claude/harness.json
git commit -m "008: AGENTS.md §11/§12 + harness.json regen for AGENTS edit"
```

---

## Task 6: Quality gates

- [ ] **Step 1: Run `/next-verify` (or equivalent)**

Run:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build
```

Expected: all five green. If any fail, fix root cause before proceeding; do not skip.

- [ ] **Step 2: Mark spec acceptance boxes**

Edit `specs/governance/008-harness-postedit-tsc.md` Acceptance section: flip each `[ ]` to `[x]` for boxes whose condition is now true. (HUMAN action — `specs/governance/**` is denied.)

- [ ] **Step 3: Update spec frontmatter to `status: shipped`**

(HUMAN action — denied path.) Clarence sets:

```yaml
status: shipped
shipped: 2026-05-28
impl_pr: <url after PR opens>
```

- [ ] **Step 4: Commit spec update**

```bash
git add specs/governance/008-harness-postedit-tsc.md
git commit -m "008: mark shipped"
```

- [ ] **Step 5: Open PR**

Title: `008: harness PostToolUse tsc reintroduction`. Body links spec file. Do not request review with red gates.

---

## Rollback

Single revert:

```bash
git revert --no-edit <merge-commit-sha>
```

Then re-run `/regen-harness` from prior `AGENTS.md` / `settings.json` state. Hook is feedback-only so a botched revert cannot block agent edits.

---

## Self-review (spec ↔ plan coverage)

| Spec Acceptance                                                    | Plan task                              |
| ------------------------------------------------------------------ | -------------------------------------- |
| `.ps1` exists, no `$VAR`, no `&`, exit 0                           | T1 Step 1                              |
| `settings.json` PostToolUse block present                          | T3 Step 1                              |
| `harness.json` lists `.ps1` + 6 hashes match                       | T4 Steps 1–3 (re-run after T5)         |
| AGENTS.md §11 PostToolUse row                                      | T5 Step 1                              |
| AGENTS.md §12 spec 008 note                                        | T5 Step 2                              |
| `/regen-harness` skill body lists new `.ps1`                       | T2 Step 2                              |
| `pnpm format:check && lint && typecheck && test:ci && build` green | T6 Step 1                              |
| Manual `.ts` edit fires hook without parser error                  | T3 Step 4                              |
| Spec hash matches at impl PR time                                  | T6 Step 5 (commits include final spec) |

All acceptance boxes covered. No placeholders. Method names (`/regen-harness`) consistent across tasks.
