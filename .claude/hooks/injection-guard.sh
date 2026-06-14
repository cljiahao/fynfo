#!/usr/bin/env bash
raw=$(cat)
[ -z "$raw" ] && exit 0
prompt=$(echo "$raw" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt',''))" 2>/dev/null) || exit 0
lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')
for phrase in 'ignore previous instructions' 'ignore all previous instructions' 'disregard previous instructions' 'forget your instructions' 'you are now a different ai' 'developer mode enabled'; do
  if [[ "$lower" == *"$phrase"* ]]; then echo 'BLOCKED: LLM01' >&2; exit 2; fi
done
exit 0
