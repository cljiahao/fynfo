# 087 independent transport and lifecycle findings

Prepared 2026-10-10 from root's actual browser artifact. This records external investigation evidence, not an approved product implementation or shipped remediation. No executable product files changed.

## Evidence and method

Sources: local synthetic artifacts `087-browser-traces.json`, `087-browser-proof.jpg`, `087-derived-analysis.json`, `087-diagnostic-build.log`, `087-http-boundary-proof.json`, `087-rsc-experiment-scope.md`, and the external `087-rsc-lab/` source. Raw browser trace SHA-256 is `d2ede33900469c0c27f56e8aee8a2e303a772915c12fae03dffce012bc4d164b`; these artifacts remain local and are not repository fixtures. Root verified the final server stopped and browser tab closed. The browser trace contains 24 cold-unlock and 24 initial-unlocked runs; iteration 0 in each group is excluded. Each compared profile/transport or profile/mode group contains five runs. Separate SCF fast-assets startup warmup is also excluded.

Cold timing origin is the captured Unlock control-click; initial timing origin is document navigation time zero. The primary observation is the first connected, layout-visible marker sampled at an animation frame. All-ready is the maximum of the two first-marker times in each run, then the median across runs. Client effect timestamps supplement server intervals; they are not substituted for DOM first-visible timing.

These are fixed public75/800 ms datasets on loopback, Next.js 16.3.8 production **webpack**, React 19.2.5, Query 5.97.0. This does not measure authenticated app data, Vercel latency, product Turbopack, viewport visibility or perceptual paint. The 200 ms diagnostic resource poll and JSON serialization impose shared measurement overhead. Root's trace qualification reports no concurrent heavy local jobs. Resource labels infer owned path/query patterns, not request method or headers; initial document streaming is excluded from fetch resource metadata.

## Cold unlock: locked document, then mount readers

All 20 measured before states contain zero events, fallback calls, marker DOM observations and resource fetch entries. Each after state has exactly two dataset fallback calls and two completed owned fetch resource entries. Same profiles, keys and staleTime are used; fresh hard-loaded locked documents avoid warmed layout caches.

| Profile                 | Fallback transport | Asset median ms | Expense median ms | Both-ready median ms | Server interval overlap range ms |
| ----------------------- | ------------------ | --------------: | ----------------: | -------------------: | -------------------------------: |
| Assets 75, expenses 800 | Server Function    |           104.0 |             908.8 |                908.8 |                         -7 to -5 |
| Assets 75, expenses 800 | Public HTTP        |           104.5 |             824.2 |                824.2 |                         77 to 86 |
| Assets 800, expenses 75 | Server Function    |           821.5 |             913.5 |                913.5 |                         -8 to -6 |
| Assets 800, expenses 75 | Public HTTP        |           815.8 |             102.5 |                815.8 |                         76 to 89 |

Negative overlap means the first completed before the second began. SCF starts the assets read first in this fixture: a fast expense waits behind slow assets. Public GET reads overlap and preserve independent readiness. This proves the reviewed transport distinction in this public fixture; it does not approve a financial read API or quantify production improvement.

## Initially unlocked: parallel server prefetch

Every measured initial-unlocked run has zero client fallback calls and zero owned fetch resources beyond the excluded document stream. Server reads overlap in both modes; await-all delays disclosure of the already-fast dataset until the slow one completes.

| Profile                 | RSC dehydration mode | Asset median ms | Expense median ms | Both-ready median ms |
| ----------------------- | -------------------- | --------------: | ----------------: | -------------------: |
| Assets 75, expenses 800 | Await-all            |           868.2 |             868.2 |                868.2 |
| Assets 75, expenses 800 | Pending              |           105.0 |             824.8 |                824.8 |
| Assets 800, expenses 75 | Await-all            |           862.2 |             862.3 |                862.3 |
| Assets 800, expenses 75 | Pending              |           825.4 |              94.1 |                825.4 |

Pending dehydration helps initial already-unlocked readiness in the fixture without duplicate client reads. The cold-unlock results separately show why this alone does not parallelize post-PIN client Server Function calls. A combined single-action await-all response could also gate fast sections on the slowest read; it is not selected merely because total transport might improve.

## Lifecycle qualification

- Clear/remount replayed the original asset marker and later original expense result with no fallback reads. Cache clearing alone does not invalidate a retained hydration payload.
- Switching synthetic identity while slow assets were pending replayed fixture-a data after the switch, again with no fallback. This is a deliberately unsafe public negative control, not evidence that the shipped 095 boundary leaks real account data.
- Lock/unlock before the original expense completed replayed retained fixture-a data after unlock. During lock the readers were unmounted; the original payload remained available afterward.
- The experimental discard checkbox produced fixture-b assets/expenses through new serial SCF reads after switching. No old fixture-a marker appears after the switch in this run. This fixture toggle does not establish an authenticated vault/RSC-generation protocol.
- Delayed expense failure showed the opaque error, then successful retry created one expense fallback/resource read. Assets retained the original server timestamps; no asset fallback or reread occurred. Successful retry still takes the configured 800 ms expense delay.
- Newer-idle replay retained both locally newer markers with zero fallback reads.
- Existing local 1200 ms in-flight expense fetch settled to `local-inflight-expenses`; no Server Function fallback was introduced. The retained payload did not replace the in-flight result in this tested case. This is local Query arbitration proof, not remote cancellation proof.
- Explicit locked-to-unlocked navigation has an actual RSC fetch (start 253.9 ms, end 1077.8 ms); later manual mount uses its resolved payload without fallback. The user waited between navigation and mount. Do not report that wait or router.replace as automatic unlock refresh latency/completion.
- Next Link away/back performed owned RSC fetches. The settled artifact includes the back fetch, newer server start/end timestamps and zero fallback calls. Cached markers reappeared before the newer RSC reads completed. The DOM probe intentionally deduplicates unchanged marker text, so later same-text freshness is confirmed by supplemental data/effect timestamps, not a new first-visible marker event.

## Primary contracts and product recommendation

[Next's official Server Function guidance](https://nextjs.org/docs/app/getting-started/mutating-data) explains current sequential client dispatch and identifies server-side parallel reads as an alternative. The live documentation now describes 16.4.0; actual installed 16.3.8 transport evidence above is the basis for this experiment.

[TanStack's advanced SSR guidance](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) describes pending dehydration/streaming. The v5 URL redirects to latest, whose examples now use APIs differing from installed 5.97.0. Installed 5.97.0 `query-core/src/hydration.ts` and `react-query/src/HydrationBoundary.tsx` are decisive: retained pending promises can recreate queries, newer existing cache is compared by timestamps, and existing in-flight work is treated separately. Do not copy latest examples or weaken default error redaction without a separate contract review.

Do not choose the public HTTP prototype as product architecture. Constitution §2.2 reserves API routes for documented exceptions; §2.3 still requires identity then vault for encrypted reads. A financial HTTP endpoint needs a concrete governance proposal plus actual auth/vault/cache/error/lifetime proof before implementation. The public fixture contains none of those guards.

The smallest useful ordinary product investigation is a **bounded overview snapshot read** that retains the established authenticated Server Function surface and the complete history query. `dashboard-overview.tsx` currently consumes only the latest two snapshots for first-row totals and the latest snapshot for planning, while `snapshot-actions.ts#getSnapshots` loads/decrypts all parents and entries; MonthlyReview genuinely still needs full history. A separate feature-owned summary read must use a structured noncolliding key such as `['snapshots', {scope:'summary', limit:2}]`, owner predicates, deterministic latest-two selection and complete entries for those selected IDs. Never truncate the shared history key or create a second inconsistent arithmetic path. Existing prefix invalidation must refresh both consumers. First measure the actual synthetic dashboard with MonthlyReview mounted: the extra summary read may duplicate work or be queued behind history, so retain it only if first-row latency improves without total-read regression.

After that read-cost baseline, a feature-owned pending-RSC preload is a candidate for initial already-unlocked visits, but implementation remains blocked on a coherent lifetime proof: retain/replace payload across lock, signout, identity change, unlock and route-cache replay; test default redaction, failed-only retry and existing cache/in-flight behavior with actual product 095 providers. Move fetching out of the thin page rather than expanding page responsibilities. Do not claim this addresses cold unlock. No product remediation, schema, dependency, crypto or permission-protected edit is approved by this findings record.

## Follow-up: nested-promise Server Function browser proof

Root subsequently measured the reviewed `server-bundle` control. Evidence: `087-bundle-browser-traces.json` (SHA-256 `d96cddf9e3c8ba06ddbcd55dce9ca5e0624fe5186aa1dea76a633a3d6b3d0da8`), `087-bundle-browser-proof.jpg` and independent `087-bundle-derived-analysis.json`. Same fixed public dataset/version/webpack/DOM sampling limits apply. Twenty-four cold runs include four iteration 0 startup controls; five runs per compared cell remain. All 20 measured before states have zero reads/DOM/resource events. Bundle runs contain two logical query fallback entries, exactly one bundle-invoke and one completed owned fetch resource. The shared outer object resolves before either delayed source; each query then awaits its own nested outcome.

| Profile                 | Transport                 | Asset median ms | Expense median ms | Both-ready median ms | Outer median ms | Source overlap ms |
| ----------------------- | ------------------------- | --------------: | ----------------: | -------------------: | --------------: | ----------------: |
| Assets 75, expenses 800 | Separate Server Functions |           103.9 |             912.7 |                912.7 |               — |          -7 to -5 |
| Assets 75, expenses 800 | Nested-promise bundle     |            93.6 |             819.2 |                819.2 |             7.1 |          77 to 88 |
| Assets 800, expenses 75 | Separate Server Functions |           817.0 |             911.1 |                911.1 |               — |          -6 to -5 |
| Assets 800, expenses 75 | Nested-promise bundle     |           818.1 |              85.0 |                818.1 |             7.4 |          74 to 84 |

Unlike an await-all aggregate, the fast source becomes layout-visible while the 800 ms source remains pending. This is actual installed Server Function Flight transport evidence, not only serializer support. It permits investigating an existing-action-surface remedy without introducing a financial HTTP route, but does not establish product cache/authorization/lifetime correctness.

Bundle failure handling resolved opaque per-source outcomes. Retry created one additional ordinary expense request; the original asset timestamp/marker stayed unchanged. Synthetic identity switch cleared old queries/cohort and produced fixture-b through a new generation, with no late fixture-a marker after the switch. Lock recorded zero currently mounted markers; unlock started a fresh generation/request before the old request finished. Generation1 displayed fresh timestamps; the old result did not become visible. These controls use public identity/generation machinery, not real 095/vault providers. Product cancellation, simultaneous mutations/optimistic patches and subset retries still need meaningful proof.

The earlier recommendation to investigate bounded summary reads is superseded as the immediate next step by this more direct evidence-backed **overview-only pending-read cohort** proposal108. Full snapshot history remains unchanged, avoiding extra summary/history reads until measured necessity. Product implementation is not approved by this external findings file; root requested a concrete scoped ordinary remediation record before application edits.
