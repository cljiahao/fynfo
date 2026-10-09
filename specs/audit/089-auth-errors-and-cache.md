---
id: '089'
area: audit
status: owner-authorized
created: 2026-10-10
author: Codex
constitution_satisfies:
  - '§2.3'
  - '§3.2'
  - '§4.2'
  - '§4.4'
  - '§7.4'
  - '§8.2'
---

# Authentication failure clarity and session response caching

## Owner authorization and evidence

Clarence's sequential roadmap and 2026-10-10 parallel-worktree instruction authorize ordinary scoped remediation under §7.4. This record documents those instructions, not owner approval of unreviewed findings. Root selected existing auth-error/cache fixes after a read-only roadmap H investigation. No signup/recovery feature, provider settings, dependency, migration, encryption protocol, protected file or real account/session/environment access is included.

Callback failures already redirect to a known login query code, but login never displays it. Google OAuth ignores returned errors and permits repeated PKCE starts; password sign-in leaves thrown failures without visible retry feedback. Callback thrown code-exchange failures escape as server errors. Installed @supabase/ssr 0.10.2 supplies no-cache response headers as the second cookie setAll argument; proxy drops that argument and reconstructed redirects preserve only cookies. These are source defects; no live CDN disclosure or authentication exploit is claimed.

## Scoped batch before edits

Affected paths: src/app/(public)/login/page.tsx; src/features/auth/components/login-card.tsx, login-button.tsx, email-login-form.tsx; src/features/auth/constants.ts; src/app/auth/callback/route.ts; src/proxy.ts; new src/lib/constants/auth.ts for the fixed response cache header contract; test/auth-callback.test.ts; test/proxy-routing.test.ts; test/features/auth/email-login-form.test.tsx; new test/features/auth/login-button.test.tsx and login-page.test.tsx; this record and root-owned README clarification.

Render only the recognized callback-failure code through a boolean prop; never render provider query detail. Keep existing auth inputs visible, with a concise accessible retry error. Guard Google activation synchronously and disable while pending; handle returned and thrown failures opaquely without introducing experimental PKCE options. Password thrown failures receive generic retry feedback and never navigate. Callback exchange rejection uses the existing opaque failure redirect. Apply private/no-store cache headers to callback redirects, and retain only the installed SSR cache header names on proxy responses and reconstructed redirects/denials. Preserve refreshed cookie attributes and all current authorization/redirect checks. The generic server client remains unchanged because Server Components cannot set response headers through its cookie adapter.

## Acceptance and rollback

Meaningful tests must fail baseline for missing callback feedback, OAuth rejection/retry and pending duplication, password thrown failure, callback thrown exchange, callback cache headers and proxy cache-header preservation. Cover unknown/raw callback text suppression, successful flows, existing redirect attacks, refreshed cookies and header allowlist. Execute five gates only in the tracked-file synthetic fixture, retain every aggregate metric above80% and all stricter security floors, then perform independent source review. No real OAuth or email send is authorized as test evidence. Rollback is a scoped code revert, with no stored-data reversal. Root owns README integration; inline comments retain contracts, with no transient narration.

## Guidance and primary sources

Impeccable harden guidance informs visible recoverable errors, disabled pending controls and existing minimal login composition; no new form or visual system. Existing project next-verify skill supplies the five-gate workflow. TemplateCentral/frontend-design were requested previously but are absent from the available skill catalog; project deviations and existing patterns remain authoritative, without inventing invocation or installing skills.

[Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow) establishes verifier overwrite on overlapping flows. [SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client) requires copying auth cookies and cache headers when reconstructing responses. Installed SSR 0.10.2 types.d.ts SetAllCookies and cookies.js confirm Cache-Control, Expires and Pragma metadata. [Password authentication](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) and [email templates](https://supabase.com/docs/guides/auth/auth-email-templates) inform the separate unimplemented account/recovery proposal.

## Results and remaining scope

Baseline targeted execution ran37 tests with25 passing and12 behavioral failures, plus two unhandled provider-rejection errors that the new guards remove. The first sandbox-only attempt failed Vitest realpath access before executing tests; reviewed escalation permitted the isolated fixture run, without bypassing a hook. Post-change all37 focused tests and typecheck passed. Final pnpm check, pnpm test:ci and pnpm build passed:119 test files/926 tests; lines93.32%, statements93.02%, functions90.60%, branches88.00%. Stricter security/calculation floors remain unchanged. Evidence logs are089-red-baseline.log,089-focused.log and089-gates.log under the external synthetic visualization root. Compiled build passed; no latency or real-authentication claim follows from these results.

Root and a second independent agent reviewed the final source and installed SSR0.10.2 cookie/cache metadata contract; neither found a remaining actionable scoped issue. Root's README.md paragraph explains retry feedback and auth session no-store behavior and was synchronized/formatted after executable gates. No product source changed after the full gates. Root owns actual local Next login-layout proof with synthetic configuration, then commit/PR and green-CI delivery; this record does not mark the batch shipped prematurely.

Email signup/recovery remains proposed: no current OTP or email signup exists, but live email confirmation, exact redirects/templates and mail delivery cannot be inferred from source. Password recovery must remain vault-independent and must never imply forgotten-PIN financial recovery. No such feature/provider changes are part of089.

## Root production-fixture page confirmation

The built Next standalone fixture served its real public callback and login routes using placeholder runtime configuration only. Visiting the callback without a code reached the recognized opaque failure message; an unknown error string was not reflected. Desktop and390px mobile layouts retained labelled inputs and visible feedback, with document scroll width equal to390px. Artifacts: `089-login-desktop-proof.jpg` and `089-login-mobile-proof.jpg`. No sign-in button was submitted, no credentials were entered and no private account/provider flow was used. Unit regressions prove rejected/thrown SDK errors and duplicate OAuth protection; the browser proof covers actual route composition and layout only. The temporary tab, viewport and server were cleaned up. No application changes followed the green gates.
