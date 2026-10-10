---
id: '106'
slug: personal-record-search
area: feature
status: owner-authorized
author: Codex
created: 2026-10-10
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  ['§1.1', '§2.1', '§2.3', '§2.5', '§3.2', '§4', '§5.4', '§7.4', '§8.2']
constitution_overrides: []
---

# Spec106: Explicit personal record search

## Problem

An owner can search expenses on their page, but cannot locate a recorded account, salary month, trade or distribution across personal histories. A cache-only global search would silently omit sources never visited. Existing navigation already reaches every feature; another quick-link list would duplicate it.

## Constitution check

On2026-10-10 root reviewed the full draft and selected this exact ordinary existing-data interface under Clarence's explicit081 sequential feature authorization. Scope is roadmap081 AD, not a new SQL approval. Reuse verified owner/vault server reads without new endpoint, schema, crypto protocol, dependency or provider access. Search text/results stay client-memory-only, outside telemetry/logs/URLs/storage. Preserve095 identity invalidation and query-cache lifetime. No protected changes or HARD-rule override. This records owner-authorized feature scope without approving any dependency, persistence or new security contract.

## Investigated current consumers

- components/layout/dashboard-navbar.tsx contains desktop links and mobile navigation Sheet, both under dashboard/layout.tsx VaultGate. Add an accessible Search records action, not duplicate navigation or a new top-level page. Keep one controlled search Dialog lifetime; desktop/mobile triggers must not instantiate independently active financial search tasks.
- dashboard/layout.tsx verifies userId/unlocked key, retains AuthIdentityWatcher outside VaultGate and mounts navbar/content only while unlocked. Providers owns shared QueryClient with five-minute staleTime/no focus refetch. Search must remain inside this subtree; no portal root mounted outside it, new identity coordinator or changed cache policy.
- features/assets/hooks/use-snapshots.ts: useSnapshots key['snapshots'], distinct detail key['snapshots',id]. Salary useSalaryRecords key['salary']; expenses useExpenses key['expenses']; equity useTrades key['equity-trades']; useDividends key['equity-dividends']. Actions already use requireActionContext and readAllRows complete owner histories. Reuse exactly these history observers, not raw whole-cache inspection or detail-key coercion.
- assets snapshot-table.tsx proves `/dashboard/entry?edit=${encodeURIComponent(month)}`; entry/page.tsx consumes edit and SnapshotForm obtains coherent edit data. No proven expense/salary/trade/dividend row-focus route. Their results navigate honestly to feature pages.
- expenses/lib/expense-table.ts already filters item/info/category label; reuse the same semantics rather than another expense-only search task. Search is literal case-insensitive substring, not regex/fuzzy/provider search. Asset category and expense category labels already exist in constants.
- components/ui/dialog.tsx already supplies Radix modal/focus/Escape primitives; no Command/palette dependency required. Reuse existing Dialog, Input, Button, Link and semantic headings/lists.
- TradeData has no currency. Salary/snapshot identities are month-only. Dividends have recorded date and native currency. Do not invent monetary FX/valuation, transaction causality, payment evidence or day timestamps.

Evidence uses tracked current root-owned merged source read-only, plus external v-ac-ad-reuse-proposal.md. No confidential records, env or live accounts.

## Solution shape

### Open-only task and readiness

The navbar renders RecordSearch, whose open state mounts the Dialog shell. That shell dynamically imports RecordSearchTask only when opened; its child calls the five existing history hooks with unchanged query keys/options. Closed search triggers zero new history reads. Opening on a fresh cache can trigger five existing owner reads; fresh cached histories share observers and avoid duplicate reads, while stale caches may refetch according to incumbent query policy. Do not claim no network or current confirmed balances.

Each source has its own visible pending/error/retry/loaded status. Failed source suppresses even cached rows and uses an opaque fixed message; Retry calls only that source's existing refetch. Pending sources are not empty. Ready sources may show useful matches while others remain unavailable, with explicit partial-source wording. During background refetch, identify cached source rows as updating rather than certify them as newly verified. No global 'no matches' or complete-search claim until every source is successfully available and no update/error is outstanding. Queries use existing auth/vault/RLS; no search term in query keys/arguments.

Closing via Escape, Close, result selection or route change unmounts term/result UI immediately. Reopen starts blank. Do not clear/cancel other consumers' owner histories merely because search closes; ordinary cached/ongoing queries retain incumbent behavior.095 vault lock/account switch unmounts search and clears owner cache using its existing boundary. Old completions cannot reconstruct term/results, toast or navigate after unmount. Route changes close search through navbar pathname handling; no persistence across navigation.

### Matching and bounded display

Term is a local string, max100characters at Input and pure matcher boundary; trim/case-fold for matching only, preserve typed display. Blank/whitespace term shows concise search instructions and no record rows or quick-link menu. Literal includes matching handles punctuation/regex metacharacters safely. Text is never injected as HTML.

Native fields:

| Source        | Match text                                             | Result destination/label                                                                                      |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Snapshots     | recorded month; entry account; existing category label | Edit snapshot [month] at the proven encoded entry edit route; one result per matching snapshot, not per entry |
| Salary        | recorded YYYY-MM month                                 | Open Salary, with matching recorded month; feature page only                                                  |
| Expenses      | item, info, existing category label, recorded date     | Open Expenses, with escaped item/date/category; no fake selected-row edit                                     |
| Trades        | ticker, broker, buy/sell action, recorded date         | Open Equity, with ticker/action/date; no guessed currency or money total                                      |
| Distributions | ticker, recorded currency code, recorded date          | Open Equity, with ticker/currency/date; no actual-payment-certification claim                                 |

Exclude profile/email, household/shared records, split-person names, encrypted technical identities, private notes outside these explicit fields, governance and secrets. Info can match without displaying its whole contents. Result labels wrap and have bounded visible excerpts; React escapes all user strings. Do not send matched values/text to toast, logging or telemetry.

Render up to4 matches per source, at most20 total, so one large expense history cannot hide every other source. Display the limit explicitly and ask the owner to refine the term; this is not a total-match count. Find a fifth match only to qualify 'More matches; refine search', then stop that source's scan. Existing source lengths may state loaded record counts, never matched-complete counts. Reuse source ordering: snapshots/salary arrive chronological and may be traversed from the end for newest first; expenses/trades/distributions arrive date-descending and use their order. No additional network sorting/filtering, full match-array allocation, monetary projection, regex engine or persistent search index.

Memoize the pure result projection on the typed term and five current data references; the matcher normalizes the capped term. Worst-case rare/no-match work is still linear in loaded textual data, not magically constant time. Measure before claiming speed. Avoid speculative worker/index/debounce abstraction; if measured interaction blocks, record the finding and scope a minimal remedy before adding it.

### Planned paths/interfaces

- src/features/search/constants.ts (new): term limit100, source limit4/total20 and static source names/help.
- src/features/search/types.ts (new if needed): typed source result discriminants and display/href projection; avoid generic unknown cache adapters.
- src/features/search/lib/record-search.ts (new): pure searchPersonalRecords(term, histories) returning bounded per-source results/more flags, no side effects/mutations.
- src/features/search/components/record-search-dialog.tsx (new): open-only actual-hook task, local input, per-source status/retry, semantic bounded groups and honest links.
- src/features/search/index.ts (new): named component export; no whole-feature runtime singleton.
- src/components/layout/dashboard-navbar.tsx: responsive accessible Search records triggers and one dialog lifetime, close on pathname change. Navbar stays below VaultGate; no dashboard/layout/provider/auth edits.
- test/features/search/record-search.test.ts (new): pure native-field/bounds/order/blank/literal/privacy projection tests.
- test/features/search/record-search-dialog.test.tsx (new): actual hooks/actions deferred/mocked, cache/readiness/lifetime/navigation/privacy cases.
- Existing navbar mounted test, or test/components/layout/dashboard-navbar.test.tsx (new only if none exists): closed no history reads, one shared responsive state, keyboard/focus/route-close.
- README.md and specs/feature/106-personal-record-search.md: scoped user/data/readiness contract and qualification evidence.

No existing action/hook option change is needed: mounting only when open supplies the enabling boundary. Use existing feature exports/targeted hook imports within Fynfo conventions; inspect built client imports for accidental unrelated chart/provider pull-in before making bundle claims. No dependency, primitive, migration, auth/cache default or crypto edit.

## Out of scope

Quick-action duplication, edit/focus links not supported today, fuzzy/numeric-money search, household/profile search, server full-text/index/AI/provider search, search analytics/history, query in URL/local/session storage, saved searches, actual-record writes, sharing, timeline, certified reconciliation and exhaustive cross-domain financial coverage. Root assigned implementation after reviewed scope selection; no further feature expansion.

## Acceptance

- [ ] Meaningful baseline reds show missing actual search task, then corrected actual-mounted tests pass; no import/setup failures count as behavioral proof.
- [ ] Closed navbar/search performs zero new history reads; opening fresh cache calls each history action once, repeated matching never sends term to an action, reopen fresh cached histories does not force reads, stale-source behavior matches existing query policy.
- [ ] Native textual fields match literally/case-insensitively, blanks instruct without rows, whitespace trimming/max100 works, category labels match, one snapshot result per month, optional trade/dividend IDs do not create duplicate-key assumptions; no unknown financial currency/date fabrication.
- [ ] Five groups each at most4/total20 with qualified more flags; rare/no-match scans do not mutate input or allocate full matching arrays. Loaded counts versus display bound remain honest.
- [ ] Pending and failed sources never report empty success; cached errors hide stale rows; ready-source partial matches explicitly qualified; Retry invokes failed source only; successful mutation/cache replacement updates result projection without extra search reads.
- [ ] Proven snapshot edit href encoded correctly; other results say Open [feature]. Selection closes task; pathname change closes/reset; Escape focus returns to invoking trigger. Mobile390px and long synthetic labels do not overflow.
- [ ] Closing/reopening during deferred reads produces no restored term/results/toast/navigation; other owner cache remains intact. Actual095 Providers/VaultLockProvider/Gate synthetic signout/different-identity and late-query tests hide search and clear old-account cache, same-user refresh preserves it.
- [ ] Privacy spies/inspection show no search term in URL/history/storage/logger/telemetry/action arguments and no matched financial labels/notes in storage/logger/telemetry. The selected snapshot month may appear only in its incumbent encoded edit route, never as a search-term parameter. Source reads already transfer owner histories by existing server actions; do not falsely claim client memory means no existing data transport.
- [ ] Record synthetic interaction measurements (cold/warm open read count, matcher timing with at least1500records/source and long strings, DOM row bound) and baseline/after client bundle evidence. No speed improvement claimed without comparison; no invented universal latency threshold.
- [ ] pnpm format:check/lint/typecheck/test:ci/build pass with every aggregate metric>80%, strict security floors unchanged; second independent review, qualified synthetic browser proof and green exact-headCI before merge.

## Risk & reversibility

Opening from a fresh page may decrypt/load all five histories; it is explicit user action, not a new always-on dashboard waterfall. Very large records can still make linear matching expensive; measurement qualifies limits and may justify a separately recorded small follow-up. Shared cache data may reflect optimistic writes/cached source age, not settled external truth. The task must never label a source failure 'no results' or resurrect private UI after identity invalidation. Revert the focused UI/helper commit; no stored data or schema change.

## Open questions

- Root review/assignment: resolved by selecting the exact four-per-source, twenty-total literal native-text scope and navbar placement under081.
- Initial navbar bundle: measured below; root selected the conditional open-only task split after the static graph finding. No speculative loading abstraction was added.
- No provider/credential/migration decision required. If investigation reveals missing auth/vault lifetime contracts, stop scope expansion and report evidence instead of weakening095.

## Guidance and research

Previously reviewed Impeccable harden/craft-floor guidance keeps the interface compact with visible material readiness/limitations. Project next-verify and Fynfo architecture retained; TemplateCentral/frontend-design unavailable and not installed. [TanStack useQuery](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery) distinguishes status/fetching and cache behavior; observers retain existing query identities. [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) supplies accessible modal/focus/Escape behavior; actual mounted/browser tests qualify integration. No secret files or live records inspected.

## Implementation record before edits

Clean CPF managed worktree preserves delivered101 branch and starts impl/106-personal-record-search from origin/main d082928910e59d2fb9533e0d8237fbf8c659de63. Root selected one open-only dialog,100character literal terms,4/source20total, five existing history keys and no duplicated quick links. Impeccable new-work/craft-floor extends the incumbent Operate interface; its context loader was source-vetted and not executed because it performs unsolicited update/network/home discovery outside the owner's scoped privacy task. Existing tokens/navbar/Dialog establish visual authority. TemplateCentral/frontend-design unavailable; no installation claimed. Full gates await root host-slot coordination; targeted tests may run. Ordinary scope includes README and exact tests, no protected paths/deps/SQL/crypto.

Necessary consumer scope before export edits: src/features/assets/index.ts and src/features/expenses/index.ts expose existing category-label constants as named public exports so search complies with constitution§2.6 instead of cross-feature deep imports. No duplication or runtime helper rewrite. Remove incumbent Desktop/Mobile navigation narration comments in the touched navbar; layout behavior stays existing.

Implementation finding before correction: historical action reads cast stored category/type strings to their typed union. The search projection must preserve literal native category/type text as a fallback when no current label exists, rather than crash the whole dialog. Add a meaningful legacy-value fixture; no action/schema change.

## Verification progress

The shipped navbar baseline ran the same mounted contract tests: the closed-action control passed and the accessible Search records trigger case failed at its assertion (not an import/setup failure). Final targeted verification covers 39 cases across the matcher, actual dialog/hooks, actual navbar and existing identity lifetime tests. It proves closed zero reads, open five existing actions without search arguments, failed-source-only retry, qualified cached updates, bounded literal/native matching, blank reset on close/navigation, no storage/URL/fetch publication, and late history results remaining inert after the 095 boundary. Legacy category/type text remains searchable without crashing unrelated sources.

Scoped lint (zero warnings) and TypeScript checks pass. Full five gates, aggregate/security floors, independent source review, client bundle comparison and desktop/mobile keyboard proof remain pending. These synthetic tests do not establish production provider latency, authenticated database correctness or complete real records. No latency/bundle improvement is claimed.

## Second review and synthetic browser qualification

Root and the independent latency reviewer found no scoped blocker in the bounded literal matcher, open-only history observers, source qualification, honest destinations or 095 lifetime integration. Source remained frozen during qualification.

Root's actual-component synthetic browser proof observed closed zero reads per source; cold open one per source; typing a date did not add reads; four of six matching expenses showed the refine-search flag (eight links across this smaller synthetic fixture). Warm reopen started blank without additional reads. Escape returned focus to the Search records trigger. Cached salary updates were visibly qualified, then a source error suppressed salary links; restoring the source and reopening recovered it. The browser did not exercise the manual Retry button; mounted tests prove failed-source-only retry.

At 390px the dialog rectangle was x16/width358 and its content scroll width341; the long label wrapped. An earlier driver body width398 observation was followed by no offending DOM rectangles, so this qualifies modal fit rather than claiming the entire app has no overflow. Root captured 106-search-desktop-proof.jpg and 106-search-mobile-proof.jpg externally, then closed the tab and reset the viewport.

A delayed distribution source showed pending/partial state. Closing, completing the old read and reopening kept the term blank. Same-account refresh preserved search access; a different identity hid the financial subtree through the actual 095 gate. The preview substitutes memory actions/session events and disables Link navigation/writes; it is not authenticated database, provider, RSC or production transport proof. Mounted tests separately verify hrefs/result-close callbacks and stale completion boundaries. The synthetic preview server was stopped after qualification.

## Scoped matcher measurement

External 106-benchmark.cjs transpiles the actual pure matcher and existing constant sources without executing feature actions. Each history contains 1,500 synthetic records, with approximately 1,000-character textual fields where supported. After 20 warm-up iterations, 100 samples on this Windows host recorded: no-match p50 8.586ms/p95 13.517ms/max22.753ms; rare late-month two-result search p50 4.709ms/p95 7.413ms/max10.728ms; frequent date search with 20 results p50 0.0196ms/p95 0.0477ms/max0.2795ms. Host contention changes results. This is Node projection evidence, not browser interaction or a comparative performance gain; worst-case scanning remains linear. Closed/open query counts above qualify the explicit read boundary only. Fair production client-bundle comparison and all five project gates remain pending coordinated capacity.

## Measured conditional loading correction before edits

Same-tree builds changed only the Navbar relative to d082928, then restored the corrected SHA256 f5bfb482935a50776b5f41b9cac6fc64b4553deca02fd0e87a026d1dd9f5d09b. The unique route client-reference/root JavaScript union measured dashboard baseline 1,578,251 raw/451,546 gzip bytes versus corrected 1,583,713/452,851; expenses baseline 1,404,349/401,520 versus corrected 1,576,302/450,071. This is generated route-reference evidence, not observed transfer. The expenses increase of 48,551 gzip bytes justifies the draft's conditional split.

Root selected the ordinary conditional task split on 2026-10-10 before further edits. Keep the navbar trigger and accessible Dialog shell small; explicitly import the matcher/five-hook task only on open. Record src/features/search/components/record-search-task.tsx and src/features/search/lib/load-search-task.ts as additional paths. Use the latter as a small explicit dynamic-import boundary with meaningful deferred/failure tests in the existing dialog test. Keep fixed loading/failure copy and retry in the visible shell; ignore module completion after close, preserve modal focus and autofocus the requested input once ready. Module cache behavior does not change query cache/read policies, and no term becomes an import argument. Re-run fair builds, targeted review and gates before delivery; no dependency, new query or security contract.

## Conditional split verification

The shell now imports only Dialog/Button, icon, React and a static-path dynamic loader; the search barrel exports only the shell. The actual matcher and five hooks live in the explicitly loaded task. Successful task loading autofocuses the requested input. A failed code load stays opaque and offers Retry search; browser module errors can remain cached, so retry is an attempt rather than guaranteed recovery. Guarded loader completion/error cannot reopen a closed task or overwrite a newer one.

All 42 targeted cases and scoped zero-warning lint/TypeScript checks pass after the split. Actual task code is preloaded only by component-test setup to separate Vitest transformation delay from UI assertions; controlled deferred module promises explicitly prove loading zero reads, failed-load retry/focus, and old success/failure after close/reopen. Existing source/cache/095 tests still pass.

Fair baseline/split builds both passed with identical synthetic values and only the Navbar temporarily changed. Exact corrected Navbar hash restoration was verified. Baselines repeated identically: dashboard 1,578,251 raw/451,546 gzip and expenses 1,404,349/401,520 bytes. Final split produced dashboard 1,580,105/452,148 and expenses 1,406,203/402,122, an increase of 1,854 raw/602 gzip bytes each. The expenses static-task reference increase was 48,551 gzip bytes; the conditional split reduces that measured always-mounted route-reference cost. Unique chunk counts match the baseline. These are summed raw and individually gzipped generated client-reference/root JavaScript files, not measured network transfer, Brotli size or user latency. The task still loads its code and owner histories after explicit opening.

Root's split source review found no blocker. The earlier browser screenshots qualify the static version's modal layout and history UI; final loader behavior/focus is additionally covered by mounted tests, with any final browser recheck recorded separately. Full five gates and normal delivery hooks remain pending.

Root's final synthetic browser recheck used the actual dynamic loader: closed reads stayed zero; cold open visibly showed Loading record search with the Close control focused, then the loaded task autofocus moved to Search your records. Date matching rendered actual synthetic results. Escape returned to the Search records trigger; warm reopening started blank with input focus and retained one read per source. Root saved 106-search-deferred-proof.jpg with getScreenshot, closed the tab and left the viewport reset. Links and writes remain disabled adapters, so this is actual component/loading/focus proof rather than hosted navigation or authenticated transport qualification. The preview server was stopped afterward.

Independent final split review found no scoped blocker: no static task graph in the shell/barrel, guarded module completion after close, opaque failure/retry before reads, focus and existing095/pathname contracts preserved. The reviewer did not independently rerun build measurements. Permanently missing deployment chunks may require reload or deployment recovery; retry does not promise recovery. Root released the heavy slot for final five gates and normal hooks; source is frozen.

## Final local gates

All five required gates pass on the frozen executable source: format:check, zero-warning lint, typecheck, test:ci and production build. The full suite passed 132 files/1,129 tests; aggregate coverage is 93.66% statements, 89.39% branches, 91.45% functions and 93.94% lines. Existing stricter security floors remain unchanged and passed. External logs are 106-format.log, 106-lint.log, 106-types.log, 106-coverage.log and 106-final-build.log. All fifteen scoped fixture/worktree paths matched before these gates; later additions are documentation-only evidence. Normal commit/pre-push hooks and exact-head CI remain required before merge; this record is not marked shipped.
