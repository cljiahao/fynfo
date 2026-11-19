# Next.js 16.4.2 to 16.4.6 security patch

Owner-authorized remediation under CONSTITUTION §7.4 and AGENTS §1.5. Approval of findings is not claimed.

## Request and scope

Clarence authorized on 2026-11-19, in chat: "do the next.js security upgrade". Scope: patch bump of the existing `next` and `eslint-config-next` dependencies from 16.4.2 to 16.4.6 within the same minor, plus the resulting `pnpm-lock.yaml` change and this record. No new dependency, no other dependency bump, no source change.

## Evidence

- `pnpm build` on 16.4.2 exits 1 on its first run with a Next `SecurityFatalError` upgrade nudge stating the installed version has a known security issue.
- `npm view next dist-tags.latest` returns 16.4.6 on 2026-11-19. No advisory identifier was retrieved, so none is cited; the Next.js release notes for 16.4.3 to 16.4.6 were not reviewed.

## Affected paths

- `package.json`: `next` and `eslint-config-next` pinned to 16.4.6 (exact-pin style kept).
- `pnpm-lock.yaml`: next and eslint-config-next entries, their `@next/*` and swc platform packages, and transitive refreshes pnpm made with the narrow `pnpm add -E` commands: `caniuse-lite` 1.0.30001787 to 1.0.30001819, `minimatch` 10.2.5 to 10.2.6, and the `brace-expansion` 5.0.5 entry removed. No other package moved.

## Acceptance and rollback

Acceptance: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci` and `pnpm build` green, and `pnpm build` passes on its first run with no `SecurityFatalError` nudge. Rollback: revert the commit and run `pnpm install`; no stored data changes.
