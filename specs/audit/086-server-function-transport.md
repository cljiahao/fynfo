---
id: '086'
area: audit
status: draft
created: 2026-10-10
author: Codex
constitution_satisfies:
  - '§4.5'
  - '§7.4'
  - '§8.2'
---

# Synthetic Server Function transport measurement

## Scope and authorization

Clarence authorized parallel worktrees for the approved roadmap on 2026-10-10. Root coordination requested this concrete read-only fixture investigation after spec085's baseline. It does not change production architecture, auth, vault cookies, dependencies, migrations, protected files or CI. No confidential record or real environment file is accessed.

## Protocol

A new external local folder 086-next-action-lab contains a minimal Next.js 16.3.8 / React 19.2.5 app using already installed dependencies. All reads return only fixed names, a 450 ms delay and monotonic timing metadata. No Supabase integration, authentication, cookies, financial fields, external fetch, telemetry or input is present.

The first button calls two exported readonly Server Functions in Promise.all from the client. The second button invokes one exported function that runs the same two helpers concurrently on the server. Client elapsed duration and server read overlap are displayed as synthetic JSON. Negative overlap indicates separated server reads; positive overlap indicates concurrency. Record one warmup per mode, then five alternating runs. Production-build the fixture to remove development compilation from timings and bind only 127.0.0.1:4186. Never inspect request cookies, bodies or headers. Request counts may be collected only through already documented browser tools without sensitive transport details; omit counts if unavailable.

This isolates the documented framework dispatch contract; it does not estimate production database, authentication, decryption, route streaming or unlock-to-ready latency. Real product changes need a separate scoped reader/cache contract, complete histories, owner/vault checks and measured before/after browser evidence.

## Build, operation and reversal

The lab is outside tracked source under the synthetic visualization root. A verified junction points only to the independently installed spec085 fixture node_modules. Never run pnpm install or permit module purging in the lab. Invoke installed Next CLI directly. Lab-only Turbopack root is the parent synthetic visualization directory so the junction resolves; no product config changed.

Production build passed. Start: node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 4186. Server session 91964 was owned by this investigation and stopped with Ctrl+C after root browser review. Do not copy product .next output or real environment files. No recursive deletion or persistent service is needed.

## Acceptance and remaining evidence

- [x] Existing dependency versions only; synthetic code inspection confirms no secret/private data reads.
- [x] Production build succeeds; loopback-only server is ready.
- [x] Browser warmups and five alternating measurements recorded by root.
- [x] Second review checks overlap against client timing and records limits.
- [x] Stop the dedicated lab server and close the temporary browser tab.

[Next.js Server Function guidance](https://nextjs.org/docs/app/getting-started/mutating-data) and installed action-queue source motivate this protocol. No product speed claim, deployment or shipped metadata is warranted by fixture build alone.

## Browser result and second review

Root completed the browser transport protocol and closed the temporary tab. After separate warmups, five alternating measured runs produced:

| Mode                                      | Median elapsed | Mean elapsed | Server read overlap          |
| ----------------------------------------- | -------------- | ------------ | ---------------------------- |
| Two client-dispatched functions           | 995.7 ms       | 1125.32 ms   | All negative: -21 to -332 ms |
| One function with internal parallel reads | 501.4 ms       | 519.76 ms    | Positive: 452 to 489 ms      |

Cold warmups are recorded separately and excluded from this comparison. Other authorized verification ran on the host concurrently. The results demonstrate the installed framework's client queue versus parallel work inside one function for fixed synthetic delays. They do not demonstrate a production latency gain, financial-data accuracy, auth/vault behavior or database performance. Server overlap independently corroborates client elapsed differences; no product optimization was implemented.

Raw synthetic evidence remains outside source in 086-browser-runs.json and screenshot 086-transport-proof.jpg under the visualization root. Root confirmed tab closure; the dedicated loopback server was stopped with Ctrl+C after measurement. This completes fixture operation and second review. Spec086 is companion investigation evidence for the spec085 baseline delivery. It does not claim a shipped product optimization.
