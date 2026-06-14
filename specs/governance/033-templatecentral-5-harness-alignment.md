---
id: 033
slug: templatecentral-5-harness-alignment
area: governance
status: shipped
author: Claude (Opus 4.8)
created: 2026-06-14
approved: 2026-06-14
shipped: 2026-06-14
impl_pr: # direct-to-main per solo-project workflow
supersedes:
constitution_satisfies:
  - '§7.1' # constitution/harness amendment protocol
  - '§8.2' # enforcement-layer edits are human-only; agent drafts, human applies
constitution_overrides: # none
---

# Spec 033: templateCentral 5.0.1 harness alignment

## Problem

The templateCentral plugin moved to **5.0.1**. Three pieces of Fynfo's harness now drift, one of which is an actual breakage:

1. **(BREAKAGE) Seeded project skills are flat files and no longer load.** `.claude/skills/next-verify.md` and `.claude/skills/regen-harness.md` are flat `.md` files. Per the tc5.0.0 changelog, Claude Code **silently ignores** flat `.claude/skills/<name>.md` — project skills must be `.claude/skills/<name>/SKILL.md` directories. Corroborated this session: neither `/next-verify` nor `/regen-harness` appears in the agent's loaded skill list. So AGENTS.md §9, which documents both as working project skills, is currently false.
2. **Harness schema floor bumped 4.0.0 → 5.0.0.** AGENTS.md marker is `<!-- templateCentral: nextjs@4.0.0 -->`; `harness.json` is `templatecentral_version: 4.5.0` with two **stale hashes** (`.claude/settings.json`, `.claude/hooks/guard-protected-paths.ps1`) left over from the gov-013 guard relaxation — the regen pending since the 004/005 session.
3. **`.agents` not git-ignored.** tc5.0.1 mandates `.agents` in `.gitignore` (a committed symlink breaks Windows CI). Currently preventive only — no `.agents` symlink exists on disk.

## Constitution check

- Satisfies: `§7.1` (harness/amendment protocol), `§8.2`.
- Overrides: none.
- **This entire spec edits the enforcement layer (`.claude/skills/**`, `.claude/harness.json`) + the AGENTS.md harness marker.** Per `§8.2` these are **human-only** — the agent drafted this spec; **Clarence reviews, applies the runbook below, and commits.** The agent must not (and cannot — guard hook + auto-mode classifier block it) perform the file edits.

## Solution shape

### Part 1 — Skills flat → directory (the real fix)

Both skill files already have correct `name:` frontmatter, so this is a pure move:

```
.claude/skills/next-verify.md     → .claude/skills/next-verify/SKILL.md
.claude/skills/regen-harness.md   → .claude/skills/regen-harness/SKILL.md
```

No content change needed inside the files. After the move, confirm `/next-verify` and `/regen-harness` appear in a fresh session's skill list.

### Part 2 — Version markers

- AGENTS.md line 1: `nextjs@4.0.0` → `nextjs@5.0.0`.
- `harness.json`: `templatecentral_version` `4.5.0` → `5.0.0`; update the two skill paths to the new `…/SKILL.md` form; recompute ALL `origin_hash` values (picks up the stale settings.json + guard-protected-paths.ps1 too).
- Update the `regen-harness` skill's embedded `files` list + hardcoded version string (currently `4.5.0` on line 19, paths on lines 14-15) to match the new skill paths + `5.0.0`, so the next regen stays correct.

### Part 3 — `.gitignore`

Append `.agents` (with a one-line why). `.gitignore` is NOT a guard-protected path, but it's bundled here so the whole tc5 alignment lands in one reviewed commit.

## Apply runbook (Clarence runs from repo root)

```bash
# 1. Skills → directory form (preserves git history)
mkdir -p .claude/skills/next-verify .claude/skills/regen-harness
git mv .claude/skills/next-verify.md   .claude/skills/next-verify/SKILL.md
git mv .claude/skills/regen-harness.md .claude/skills/regen-harness/SKILL.md

# 2. AGENTS marker  (edit line 1)
#    <!-- templateCentral: nextjs@4.0.0 -->  →  nextjs@5.0.0

# 3. Edit .claude/skills/regen-harness/SKILL.md embedded python:
#    - version '4.5.0' → '5.0.0'
#    - the two skill paths → '.claude/skills/next-verify/SKILL.md',
#      '.claude/skills/regen-harness/SKILL.md'

# 4. .gitignore — append:
#    # tc5.0.1: per-machine symlink; a committed symlink breaks Windows CI runners
#    .agents

# 5. Regenerate harness.json (run the updated regen-harness skill, or):
python - <<'PY'
import hashlib, json, datetime
files = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json',
         '.claude/skills/next-verify/SKILL.md', '.claude/skills/regen-harness/SKILL.md',
         '.claude/hooks/post-edit-tsc.ps1', '.claude/hooks/stop-tests.ps1',
         '.claude/hooks/injection-guard.ps1', '.claude/hooks/guard-protected-paths.ps1',
         '.claude/hooks/guard-destructive-bash.ps1']
out = {'templatecentral_version': '5.0.0', 'stack': 'nextjs',
       'seeded_at': datetime.date.today().isoformat(), 'seeded_files': {}}
for f in files:
    with open(f, 'rb') as fh:
        out['seeded_files'][f] = {'origin_hash': hashlib.sha256(fh.read()).hexdigest(), 'path': f}
with open('.claude/harness.json', 'w') as fh:
    json.dump(out, fh, indent=2)
print('regenerated @ 5.0.0')
PY

# 6. Verify, then commit
pnpm check          # sanity (no src change, should be green)
git add -A && git commit   # governance commit; Clarence-authored
```

After committing, set this spec `status: shipped`, `shipped: <date>`, and update AGENTS.md §12 with a gov-014 note.

## Out of scope

- Any change to hook _logic_ (`guard-*.ps1`, `stop-tests.ps1`, `post-edit-tsc.ps1`, `injection-guard.ps1`, `post-edit-tsc.ps1`) — only their hashes get recomputed.
- `settings.json` permission semantics — unchanged; only its hash refreshes.
- The `.agents` symlink itself (per-machine convenience; create locally if wanted, never commit).
- App/src code. This is harness-only.

## Acceptance

- [ ] `/next-verify` and `/regen-harness` load in a fresh session (appear in skill list / invoke without "unknown skill")
- [ ] AGENTS.md marker reads `nextjs@5.0.0`
- [ ] `harness.json` `templatecentral_version: 5.0.0`; skill paths are `…/SKILL.md`; all 10 hashes recomputed (settings.json + guard-protected-paths.ps1 no longer stale)
- [ ] `.gitignore` contains `.agents`
- [ ] `pnpm check` green (no src change)
- [ ] AGENTS.md §12 gov-014 note added; this spec `status: shipped`

## Risk & reversibility

- **Blast radius:** harness/tooling only — zero runtime/app impact. Worst case a skill path typo → skill still doesn't load (same as today). No data, auth, or build path touched.
- **Reversibility:** single `git revert` (the `git mv`s revert cleanly).
- **Backout plan:** revert the governance commit; skills return to flat (already non-loading) state.

## Open questions

- [ ] Q: Bump `templatecentral_version` to `5.0.0` (schema floor) or track the exact plugin `5.0.1`? — Owner: Clarence — A (proposed): `5.0.0` (the schema floor / marker convention, matching the migrate target); patch version of the plugin is not the harness contract version.
- [ ] Q: Run `templatecentral:migrate` instead of this manual runbook? It automates 4.x→5.x incl. the flat-skill conversion. — Owner: Clarence — A (proposed): the manual runbook is smaller and auditable for this 2-skill repo; `migrate` is the option if you'd rather it sweep everything.
