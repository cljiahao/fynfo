---
name: next-verify
description: Run all five Fynfo §3 quality gates in one pass (format:check, lint, typecheck, test:ci, build)
allowed-tools: Bash(pnpm format:check), Bash(pnpm lint), Bash(pnpm typecheck), Bash(pnpm test:ci), Bash(pnpm build), Bash(pnpm check)
---

From repo root, run all Fynfo quality gates in sequence. Fail fast on first error.

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build
```

`pnpm check` already runs `format:check + lint + typecheck`. If you need the full bar including tests + build, use the chained command above.

Report failures with the exact error output. Fix before proceeding. Do not request human review with red gates.
