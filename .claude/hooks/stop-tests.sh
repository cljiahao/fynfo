#!/usr/bin/env bash
set +e
output=$(pnpm test:ci 2>&1)
code=$?
echo "$output" | tail -20 >&2
if [ "$code" -ne 0 ]; then
  echo "Stop hook: pnpm test:ci FAILED (exit $code). Fix tests before ending turn." >&2
  exit 2
fi
echo "Stop hook: tests green. Spec linked? Sections cited? Scope respected?" >&2
exit 0
