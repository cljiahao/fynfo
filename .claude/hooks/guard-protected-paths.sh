#!/usr/bin/env bash
raw=$(cat); [ -z "$raw" ] && exit 0
tool=$(echo "$raw" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null) || exit 0
[ "$tool" != "Write" ] && [ "$tool" != "Edit" ] && exit 0
fpath=$(echo "$raw" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null) || exit 0
[ -z "$fpath" ] && exit 0
for p in '\.claude/settings\.json' '\.claude/harness\.json' '\.claude/hooks/' '\.claude/skills/' '\.env' '\.github/workflows/'; do
  if echo "$fpath" | grep -qE "$p"; then echo "BLOCKED: $fpath is protected." >&2; exit 2; fi
done
exit 0
