---
id: 005
slug: trust-proxy-host-allowlist
area: security
status: shipped # draft | approved | shipped | superseded
author: claude (opus 4.8, 2026-06-02)
created: 2026-06-02
approved: 2026-06-02 # Clarence pre-approved Phase 1 security (audit roadmap)
shipped: 2026-06-02
impl_pr: direct merge to main (no PR — owner waived)
supersedes:
constitution_satisfies:
  - '§2.1' # closes a host-header injection vector in origin resolution
  - '§4.2' # ships unit tests for the allow-list / spoof / fallback paths
constitution_overrides:
---

# Spec 005 (security): TRUST_PROXY host allow-list (origin resolution)

## Problem

`getAppOrigin()` documents `TRUST_PROXY` as a "comma-separated trusted host list", but the code only
checks that the env is **non-empty** (`if (trustProxy)`) and then trusts whatever `X-Forwarded-Host`
the request carries. The list contents are never compared. So in any deployment where `TRUST_PROXY` is
set, an attacker can spoof `X-Forwarded-Host` to an arbitrary value and the resolved origin reflects it
— classic host-header injection (poisoned absolute URLs / redirects / links). The function currently
has no callers, so the risk is latent, but the contract is wrong and will bite the first time an
absolute URL is built from it.

## Constitution check

- Satisfies `§2.1` (closes the injection vector before the helper is wired up) and `§4.2` (adds unit
  tests). Overrides: none. No migration, no new dependency. One source file + one new test file.

## Solution shape

`src/lib/utils/request-origin.ts` only:

- Treat `TRUST_PROXY` as the actual allow-list:
  - `'1'` → trust any forwarded host (explicit "trust all" escape hatch, as documented).
  - otherwise → split on `,`, trim, lowercase into a set of allowed hosts.
- Only return the forwarded origin when `fwdProto && fwdHost && hostAllowed(fwdHost)`:
  - `hostAllowed(host)` = `'1'` mode, OR the lowercased forwarded host is in the allowed set.
  - Compare the host **including any port** exactly (the proxy controls what it forwards; we match
    what was configured). Case-insensitive.
- On a spoofed / unlisted forwarded host, fall through to the existing `host`-header + scheme fallback
  (do not honor the forwarded value).
- Extract the small `hostAllowed` decision as a pure helper so it is unit-testable without
  `next/headers`.

No public signature change; `getAppOrigin()` stays `Promise<string>`.

## Out of scope

- Peer-IP validation of the proxy itself (Next.js has no portable peer-IP at this layer; the env gate
  is the contract).
- Removing the (currently unused) helper — kept; it is the intended origin source for future
  absolute-URL needs, and its key-files row in `AGENTS.md` is governance-protected.
- Any change to `NEXT_PUBLIC_BASE_URL` semantics.

## Acceptance

- [ ] `pnpm check` + `pnpm test:ci` + `pnpm build` green.
- [ ] New `test/lib/utils/request-origin.test.ts`: allowed forwarded host → forwarded origin; spoofed
      host (not in list) → host-header fallback (forwarded ignored); `TRUST_PROXY='1'` → any host
      trusted; empty `TRUST_PROXY` → forwarded ignored; no host header → `NEXT_PUBLIC_BASE_URL`.
- [ ] No new dependency, no `any`, no `console.log`. Spec hash unchanged since approval.

## Risk & reversibility

- **Blast radius**: origin resolution only; zero current callers, so no behavior change in the running
  app today. A misconfigured `TRUST_PROXY` (real host missing from the list) degrades to the `host`
  header — safe direction.
- **Reversibility**: single `git revert`.
- **Backout plan**: revert the commit.

## Open questions

- None.
