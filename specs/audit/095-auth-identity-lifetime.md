---
id: 095
slug: auth-identity-lifetime
area: fix
status: owner-authorized
author: Codex
created: 2026-10-10
constitution_satisfies:
  - '§2.3'
  - '§2.5'
  - '§2.6'
  - '§3.2'
  - '§4'
  - '§5.1'
  - '§7.4'
  - '§8.2'
constitution_overrides: []
---

# Audit 095: Financial UI lifetime across account changes

## Authorization and evidence

Clarence's explicit whole-project security audit and 2026-10-10 parallel continuation authorize reversible existing-behavior remediation under Constitution §7.4. This record documents that scope; it does not approve new authentication flows. Source inspection finds Providers retains one unowned QueryClient and DashboardLayout discards the verified user ID after checking the vault. VaultGate unmounts financial editors only when VaultLockProvider locks; no component listens for cross-tab auth identity changes. A stale unlock completion can call the provider's unconditional unlock callback. The server independently binds the vault cookie to requireUserId; retain that defense unchanged.

## Scoped solution and affected paths

Before product edits, reproduce stale synthetic financial content and local drafts on SIGNED_OUT and a different-user SIGNED_IN with actual Providers, DashboardLayout, VaultGate and VaultLockProvider. Then retain the verified server identity in the layout and add an auth-lifetime watcher outside VaultGate. Clear and cancel cached work, terminally invalidate the old vault UI lifetime, and use existing vault-lock endpoint before full navigation. Do not call Supabase auth APIs inside the auth callback. Initial-session null blocks safely with manual sign-in rather than an automatic reload loop; preserve ordinary same-account refresh events; different identity and explicit signout invalidate. Late unlock callbacks must not restore children. New client code is justified by auth events and UI lifetime management (§2.5).

Affected paths: src/app/dashboard/layout.tsx; src/components/layout/vault-gate.tsx; src/features/auth/{components/auth-identity-watcher.tsx,components/vault-lock-context.tsx,components/index.ts,index.ts,constants.ts,hooks/use-auth-identity.ts}; test/components/auth-identity-lifetime.test.tsx; test/components/vault-gate.test.tsx; README.md (root coordinates); vitest.config.ts (add 95% lines/statements, 100% functions and 85% branches floors for the new security boundary; preserve every existing threshold); this audit. Reuse existing primitives; final narrower paths may omit an unnecessary hook.

## Contracts and research

[Supabase onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) documents cross-tab events and warns against async auth calls within callbacks. Client notifications invalidate UI only; they never grant server authorization. Existing requireUserId/getVaultDekSession and cookie cryptography remain unchanged. No dependency, migration, provider setting, protected file or secret access. No signup/recovery implementation.

## Acceptance and rollback

Meaningful baseline-failing regressions must prove old data/editor removal, query-cache clearing and late-reply rejection. Preserve same-ID SIGNED_IN/TOKEN_REFRESHED/USER_UPDATED and initial-null fail-closed behavior; unsubscribe on unmount; invalidate once; handle teardown failure without restoring financial content. Review malformed/absent event sessions, prop identity changes and old unlock callbacks. Run targeted tests, an independent second review, pnpm check, pnpm test:ci and pnpm build in the isolated synthetic fixture; every coverage metric stays above 80% and security floors unchanged. README/comments describe actual behavior concisely. Revert the coherent batch to back out; no schema or data rollback.

## Limits and results

Baseline proof: both actual-layout synthetic SIGNED_OUT/different-user tests fail because the old balance and draft remain mounted (095-baseline-proof.log). Installed auth-js 2.103.0 \_emitInitialSession waits initialization then loads session under lock; null also covers loading/refresh errors, so block without automatic navigation rather than guessing identity. Independent root and latency-agent second reviews found no blocker. Targeted 20 tests pass; full pnpm check, pnpm test:ci and pnpm build pass (121 files, 993 tests). Aggregate statements 93.35%, branches 88.58%, functions 90.90%, lines 93.65%. Hook security coverage is 100% lines/functions/branches; provider 95% lines, 100% functions, 87.5% branches. Added 95/95/100/85 floors and retained all prior thresholds. Tracked source/test hashes and file inventory match the isolated fixture exactly. Log: 095-final-gates.log. Root synthetic desktop component proof passes: same-account refresh preserves balance 4500 and draft 99; account B invalidation removes both before cookie teardown completes, and late read/unlock cannot restore content; cache count remains 0. Screenshot: 095-identity-desktop-proof.jpg. This uses actual Providers/VaultLockProvider/VaultGate/AuthIdentityWatcher with synthetic auth event delivery, memory-only reads and pending mocked cookie teardown. It does not prove production/provider cross-tab delivery, RSC transitions or authenticated persistence. Mobile 390×844 proof has clientWidth and scrollWidth 390, with no horizontal overflow (095-identity-mobile-proof.jpg). Fresh synthetic lifetimes also hide the editor on other-tab signout and INITIAL_SESSION missing; the latter retains manual sign-in. No Continue link or real provider request was used. Root closed the temporary tab, reset viewport and stopped the preview server. No claim that client events revoke issued JWTs or erase every JavaScript object held by external code. Full navigation is required to discard the old mounted lifetime. Synthetic tests cannot prove hosted cross-tab delivery/provider policy. Impeccable hardening/craft guidance informs concise status and accessible recovery; existing design system retained. TemplateCentral/frontend-design are unavailable in this session's skill catalog, so no installation or invocation is claimed.
