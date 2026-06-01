# PostToolUse feedback hook: incremental TypeScript typecheck.
# Reads no input. Always exits 0 (feedback-only, never blocks the agent).
# No $VAR references, no & subprocess operator — see specs/governance/003 + 008.

$ErrorActionPreference = 'SilentlyContinue'

pnpm exec tsc --noEmit --incremental 2>&1 | Select-Object -Last 5 | Out-Host

exit 0
