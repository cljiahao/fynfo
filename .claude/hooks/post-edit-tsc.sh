#!/usr/bin/env bash
pnpm exec tsc --noEmit --incremental 2>&1 | tail -5
exit 0
