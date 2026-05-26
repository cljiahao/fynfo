---
name: regen-harness
description: Recompute SHA-256 origin hashes in .claude/harness.json after editing seeded harness files (AGENTS.md, CLAUDE.md, settings.json, project skills)
allowed-tools: Bash(python *)
---

When you edit any file tracked in `.claude/harness.json` (AGENTS.md, CLAUDE.md, .claude/settings.json, .claude/skills/\*), regenerate the manifest so drift detection by `templatecentral:standards` stays accurate. Per `AGENTS.md` §0.3, harness file edits are governance-protected — confirm scope before running.

```bash
python - <<'PY'
import hashlib, json, datetime
files = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json',
         '.claude/skills/next-verify.md', '.claude/skills/regen-harness.md']
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

Run from repo root. If a new harness file gets seeded, add its path to the `files` list. Commit the regenerated `harness.json` together with the edits that triggered the regen.
