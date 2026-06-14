#!/usr/bin/env bash
raw=$(cat); [ -z "$raw" ] && exit 0
tool=$(echo "$raw" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null) || exit 0
[ "$tool" != "Bash" ] && exit 0
cmd=$(echo "$raw" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0
for p in 'git[[:space:]]+push[[:space:]].*--force' 'git[[:space:]]+reset[[:space:]]+--hard' 'git[[:space:]]+branch[[:space:]]+-D' '--no-verify' 'docker[[:space:]]+push' 'DROP[[:space:]]+TABLE' '>[[:space:]]*.env'; do
  if echo "$cmd" | grep -qE "$p"; then echo 'BLOCKED: destructive command.' >&2; exit 2; fi
done
exit 0
