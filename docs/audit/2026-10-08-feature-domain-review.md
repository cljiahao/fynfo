# Feature domain and database review — 2026-10-08

First-pass review and recorded B/F/I remediation for audit 070, under
CONSTITUTION §7.4. Three calculation modules and their tests were changed after
the audit record named their paths; historical migrations were not changed.
No real environment files, credentials,
keys, session cookies or production data were read. Reviewed 64 current feature files (63 original plus bounded quote constants)
outside components/hooks, 14 historical migrations, and `supabase/config.toml`.
Consumers below are source/test symbol references, checked against imports at
the relevant entry points; they establish use, not comprehensive runtime reachability.

Guidance: templateCentral standards (Next.js code standards, comments, shared
validation patterns and Next.js validation). Fynfo's Supabase/server-action
architecture and governance take precedence over template defaults. Historical
migrations are retained even where a later migration supersedes their objects.
No deletion candidate was established in this assigned scope.

## Findings

### FD01 — P1: authenticated callers can reset their own vault lockout

`supabase/migrations/20260602000000_add_vault_unlock_throttle.sql:68` accepts
`p_success=true` as sufficient proof to clear the counter and lock; line 107
grants that RPC to `authenticated`. An attacker holding the account's Supabase
session can call the RPC directly between guesses without knowing its vault key.
RLS on the counter does not constrain a SECURITY DEFINER RPC. Reproduce in a
local test: record five failures, observe locked, call record(true), observe
unlocked with no canary verification. Also inspect first-row races and the
separate locked/check-record sequence; mocked route tests cannot establish SQL
atomicity. Fix requires a separately approved forward migration and a trusted
verification/reset boundary that preserves the PIN/DEK invariants, plus direct
authenticated-RPC negative tests. Do not merely hide the function in UI.

### FD02 — P1: invite consumption trusts an invite UUID without secret proof

`supabase/migrations/20260626000000_add_household.sql:179–228` exposes a definer
RPC accepting invite ID, caller user ID, and arbitrary wrapped key. It checks
identity, expiry and capacity but never checks the secret hash; calling the
bootstrap RPC first is not enforced. Anyone who learns an unused invite UUID
can join with invalid wrapped bytes and consume the invitation. UUID guessing
is impractical; this finding is conditional on identifier disclosure, not an
unauthenticated global compromise. A participant with the household key and an
invite ID can enroll a third account directly. Narrow fix: require secret/hash
proof again in the consuming transaction, validate wrapping shape, and test
direct invocation with a known UUID and wrong proof. Migration approval needed.

### FD03 — P1: two-member cap races across different invitations

The trigger at `20260626000000_add_household.sql:77` only counts members. The
consume RPC locks the invite row at line 201, not the common household row;
different invites can concurrently see one member and both insert, yielding
three. Row locks protect the selected row, per PostgreSQL documentation below.
Reproduce with one owner, two active invitations and two concurrent accept
transactions. Serialize insert/consume using the household row (including
direct owner insertion), then enforce the cap against the serialized count.
Requires approved forward migration and a real concurrent SQL regression test.

### FD04 — P1: one account can join multiple households despite one key/session

`20260626000000_add_household.sql:30` constrains only `(household_id,user_id)`.
`createHousehold` and `acceptInvite` have no existing-membership check. The
actions use the first membership (`household-actions.ts:44`, `goal-actions.ts:107`)
and `getGoals` reads all RLS-visible goals, decrypting every household with one
K_h. Two sequential create calls or two accepted household invites produce
multiple memberships and incompatible ciphertext reads; the later cookie can
also encrypt writes into the first household under the wrong key. Enforce the
single-household contract transactionally in SQL, reject duplicate membership
at the action boundary, and test both create and accept. Existing conflicting
rows need an owner-reviewed migration/data plan; do not delete them blindly.

### FD05 — P2: child replacements discard errors and can erase saved data

`snapshot-actions.ts:119` discards the entry-delete error. `expense-actions.ts:61–74`
starts parent upsert and child deletion in parallel and reads only expErr.
If the parent update fails but child deletion succeeds, saved splits are gone;
if deletion fails but insert succeeds, stale and new children coexist.
All snapshot/expense/tax-relief delete-then-insert paths can lose existing data
when the insertion fails (`relief-actions.ts:65–90`). Minimal ordinary batch:
check child-delete errors, avoid independent destructive mutation before parent
success, encrypt/validate complete replacement before deleting; test each
operation failure independently. Full rollback safety requires an atomic DB
transaction/RPC in a separately approved migration. Do not claim the minimal
batch fully solves concurrent replacements or insertion failure data loss.

### FD06 — P2: complete-history reads silently stop at the API row limit

`expense-actions.ts:20`, `equity-actions.ts:18`, `dividend-actions.ts:18`,
`snapshot-actions.ts:23`, `salary-actions.ts:17`, `relief-actions.ts:38`, and
household contribution reads do not paginate. `supabase/config.toml:21` sets
max_rows=1000; official Supabase docs confirm that default. At 1001 expenses or
trades, aggregates, owed balances and exports silently omit rows. Hosted
configuration was not inspected. Narrow fix: deterministic key-stable paging
for full-history/export contracts, with 1001-row and page-boundary tests;
consider nested relation limits separately. Raising max_rows alone only moves
the failure threshold.

### FD07 — P2: paid portions remain included in outstanding balances

`expenses/lib/owed.ts:53` accumulates settled and unsettled splits together;
lines 75–77 sum the whole month whenever any split is unpaid. Same person/month
with paid 20 and unpaid 5 returns totalOwed=25 instead of 5. Existing tests cover
all-paid/all-unpaid groups but omit a mixed group. Keep month history totals if
needed, track unpaid subtotal separately and derive totalOwed from that; add a
mixed-state regression and verify settle/unsettle transitions.

### FD08 — P2: all-insurance data produces NaN in the salary planner

`assets/lib/salary-plan.ts:37` divides by totals.length after excluded insurance
rows leave an empty map. A nonempty array containing only insurance returns
0/0; the planner consumes this average. Add an empty-post-filter guard returning
0 and regress both only-insurance and mixed-category input.

### FD09 — P2: MWR ignores sell fees and can report a rate without a root

`equity/lib/mwr.ts:57` computes sell proceeds as `(shares*price+fees)-fees`,
canceling the fee. A 10-share sale at 6 with fee 1 becomes 60 rather than 59;
`test/features/equity/mwr.test.ts` explicitly enshrines 60. Fix signed cash-flow
construction and its test. `computeIRR` returns its last guess even when all
flows have one sign or all dates are identical, and lacks a residual/convergence
check; callers present it as a computed return. Define unavailable-rate behavior
before changing the public contract, and test same-date/all-negative/no-root
inputs. Total-market MWR also mixes native SGD/USD flows, while no FX rate is
supplied; any aggregate return contract must normalize the unit consistently.

### FD10 — P2: held-share cost basis retains costs of shares already sold

`equity/lib/holdings.ts:54` divides all historical purchase cost by remaining
shares. Buy 10 at 100 then sell 5 gives costBasis=200; the remaining average-cost
position has cost 500, or 100/share. `dividend-metrics.ts:yieldOnCost` uses this
as remaining cost and understates yield. A complete sale then rebuy retains the
closed position's purchase cost too. The test explicitly expects 200 and is
not independent financial validation. Choose and document the existing intended
inventory-cost method, then sort chronologically and reduce cost on disposal;
regress partial and full disposal/rebuy. Keep lifetime purchase totals separate.

### FD11 — P2: tax rates and relief rules are stale

`salary/constants.ts:15` charges 22% for all chargeable income above 320k;
IRAS YA2024 onward adds 23% above 500k and 24% above 1m. Line 19 sets non-resident
employment flat tax to 22% instead of higher of 15% or resident progressive
rates. `tax-cpf.ts:124–129` omits the total personal relief cap of 80k (CPF relief
is part of this cap). `constants.ts:68` still offers course-fee relief after its
YA2026 lapse. These are current official-rule mismatches; historical tax-year
selection requires year-aware schedules instead of replacing every year with
today's table. Existing tests mirror .22 and lack high-income/relief-cap cases.
Use IRAS worked examples and boundary tests; distinguish income year from YA
explicitly. Owner should review scope if adding missing profile facts is needed.

### FD12 — P2: CPF and planner deductions ignore monthly/age constraints

`tax-cpf.ts:83` caps aggregate annual salary at monthlyCeiling\*12. One month
of 12k and eleven months of zero in 2026 results in 2400 employee CPF rather
than 1600; monthly capped sums are required. 2023 uses 6300 for every month,
although the ceiling changed from 6000 in September. Flat employee rate .20
ignores ages above 55 despite birthYear existing. `salary-plan.ts:96` deducts
20% on the whole salary, diverging from calculateMonthlyCpf even for a normal
below-55 10k salary (8000 take-home vs 8400 in 2026). CPF contribution eligibility
cannot be inferred solely from tax residency; citizenship/PR tenure is absent.
Narrow reuse of capped calculator can correct planner inconsistency, but full
age/eligibility/year reconstruction needs explicit contract and owner-reviewed
scope. Official CPF sources below substantiate the monthly and rate constraints.

### FD13 — P2: household dates accept impossible calendars and arbitrary suffixes

`household/schemas.ts:18–28` validates dates only with a prefix regex, accepting
2026-99-99 and `2026-01-01Tgarbage`; they reach PostgreSQL DATE columns and fail
there instead of an opaque validation error. Equity and expense schemas use
Date.parse, which also normalizes some impossible days (e.g. 2026-02-30).
Normalize accepted calendar-date/timestamp input with a strict shared boundary
parser and reject impossible days. Test leap years and suffixes; preserve the
approved accepted input shapes rather than silently narrowing timestamps.

### FD14 — P2: market actions have unbounded fan-out and untrusted quote shapes

`equity/actions/price-actions.ts:25–34` accepts an unchecked ticker array and
starts one network request per unique symbol with no count/length bounds or
timeout. An authenticated crafted action can fan out far beyond a holdings UI.
External JSON fields become StockPrice through unchecked `res.json()` property
access. `fetchExchangeRate` interpolates unvalidated/unencoded from/to values
into a fixed-origin URL. No arbitrary-host SSRF was established, but path/query
tampering is possible. Validate input sizes/currency codes and finite quote
fields, add abort deadlines and bounded concurrency, and test malformed upstream
responses. Keep best-effort null/empty failure behavior and measure before
asserting performance gains.

### FD15 — P2: export omits dividends and security copy misstates runtime behavior

`profile/lib/export-data.ts:18–26` has no dividends even though the product stores
them; use-export-data fetches only the earlier seven domains. Marketing
`constants.ts:105` claims a complete backup of everything. Add the existing
dividend domain to the versioned export with compatibility tests and accurately
state household export limitations. Line 100 says encryption occurs on device
and operators cannot read it, but feature actions encrypt/decrypt server-side
with the supplied session DEK. Correct copy to describe encrypted-at-rest data,
client PIN derivation and server session processing; do not change cryptography
to satisfy marketing language.

### FD16 — P2: direct Data API telemetry bypasses application authorization

`20260611000000_add_marketing_telemetry.sql:64–67` grants aggregate definer RPCs
to every authenticated user without the app's admin allowlist. A normal user
can call get_signup_stats/get_marketing_event_stats directly despite UI 404.
Anonymous direct table insert policy permits arbitrary path text up to 128
chars, including PII, and arbitrary timestamps/UUIDs, bypassing /api/track's
validation/rate limit. This violates the documented single ingestion gate and
admin-only aggregate boundary; aggregate disclosure itself is non-financial.
Requires an owner-approved migration/trusted ingestion design. Negative tests
must call Data API directly, not only the action wrapper.

### FD17 — governance drift: financial deletes bypass the mandatory vault gate

Personal deletes, settlement reads/mutations and household deleteGoal use
requireDbContext; it only verifies auth. CONSTITUTION §2.3 lists three exceptions,
none for deletes. Action-guard also loads identity and keys concurrently rather
than the prescribed identity-first order. RLS prevents cross-user deletion, so
this is a locked-vault destructive-action boundary/governance mismatch, not
proof of cross-user disclosure. Reconcile through authorized code remediation
or a separately approved constitutional clarification; tests currently mock
and preserve vault-free deletion. Protected rulebook changes are not authorized
by the general audit.

## Maintainability and non-findings

- Category sums are duplicated in salary-plan.ts, investment-math.ts and several
  asset view consumers. Consolidation into the existing calculations.ts public
  surface is justified by actual callers; no general finance abstraction needed.
- Cross-feature deep imports (investment-math.ts, export-data.ts and consumers)
  bypass feature barrels. Small export/import cleanup can satisfy §2.6; account
  for client/server module graph boundaries before exposing server utilities.
- tax-reliefs.ts imports a ReliefItem type from a component: move that shared
  contract into salary/types.ts only if doing a related scoped cleanup.
- trade-form-defaults documents historical reset drift; replace narration with
  the defaults/reset contract while retaining meaningful constraints. Preserve
  historical migration rationale and constitutional suppression references.
- Profile/planner/single-record reads swallow every DB error as null. A scoped
  hardening batch should return null only for no-row results and surface opaque
  operational failures; existing tests deliberately encode some silent failures.
- Planner schema accepts fractional values for INTEGER DB columns and has no
  practical count upper bound. Match the UI's integer contract; don't invent
  limits without checking existing saved values and product behavior.
- RLS exists for each current user/household table. Counter RLS intentionally
  has no policy (default-deny); this is appropriate for direct table access and
  does not resolve exposed definer RPC risks.
- broker-fees has active consumers and approximate provider formulas. No current
  fee accuracy claim is made without a full broker-specific primary-source review.
- Unknown ticker defaults to US; `.SI` Yahoo symbols outside the hardcoded alias
  map are misclassified. A contract test can cover suffixes; do not replace the
  map with speculative discovery dependencies.

## Evidence and validation limits

Read relevant existing action tests, IRR/holdings, salary/CPF, planner, owed and
guard tests. They use a fake Supabase client; they verify payload/error shapes,
not database RLS, SQL privileges, transactions or concurrent membership caps.
No SQL instance, network action attack, production setting or real user data was
used. Focused and full Vitest gates were run as recorded below; main audit owns
the remaining quality gates and independent overall post-remediation pass.
Residual findings are source-derived reproducible
cases, not claims that attacks were executed. Missing SQL/integration boundary
tests are a material security coverage gap even if aggregate coverage is high.

Primary sources reviewed:

- [IRAS individual tax rates](https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates)
- [IRAS tax reliefs and course-fee lapse](https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs)
- [IRAS course-fee relief](https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs/course-fees-relief)
- [CPF OW ceiling](https://www.cpf.gov.sg/service/article/what-is-the-ordinary-wage-ow-ceiling-mbr)
- [CPF 2023 AW ceiling calculation](https://www.cpf.gov.sg/service/article/with-the-increase-in-ordinary-wage-ceiling-from-september-2023-how-should-i-compute-the-additional-wage-ceiling)
- [CPF employee eligibility/rate factors](https://www.cpf.gov.sg/member/growing-your-savings/cpf-contributions/saving-as-an-employee)
- [Supabase select row limits](https://supabase.com/docs/reference/javascript/select)
- [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html)

## Per-file ledger

## Batch B results and second pass

Batch B changed only `src/features/assets/lib/salary-plan.ts`,
`src/features/expenses/lib/owed.ts`, `src/features/equity/lib/mwr.ts` and their
three matching tests. The root corrected the recorded salary-plan path before
its implementation. FD07, FD08 and the sell-fee part of FD09 are fixed. Paid
month history totals/rows are retained; unpaid person/headline totals now use
an independently tracked unpaid subtotal. Insurance-only input returns zero.
Buy cash flows include fees; sell cash flows deduct them.

Validation: the three regression failures were observed before source changes
(3 failed, 21 passed, 24 total). After changes the same selection passed 24/24.
A complete `node node_modules/vitest/vitest.mjs run --reporter=dot` passed
74 files / 489 tests, exit 0, on this shared workspace snapshot. Default
sandbox execution failed to spawn esbuild with EPERM; supported tool escalation
was approved and used for these local test processes. Existing mocked failure
tests emit expected structured error logs. Prettier formatted the six owned
code/test paths and this report. Main audit owns integrated lint/type/build and
coverage evidence; this scout does not claim those gates have passed.

Earlier interim second pass covered all 63 original feature source paths and 14 migrations by a static
source/security/consumer rescan, with local configuration correlation. Deep
post-change review and executable regressions were performed on the three
changed math modules and their UI consumers. The individual ledger marks that
depth; unchanged paths did not receive independent live SQL/security tests.
No new deletion candidate or new remediation scope was introduced. Main audit's
other agents independently review the overall integrated result.

Residual findings FD01–FD06, FD10–FD16 and the remaining FD09 IRR/FX concerns
remain open. FD17 identity-before-key order has since been corrected by the
root's action-guard batch; vault-free delete/settlement behavior still needs
reconciliation with the constitution. No tax/CPF, migration, cryptographic
protocol, dependency or protected-file changes were made by this scout.

### Recommended ordinary follow-up: persist normalized trade input

Exact paths: `src/features/equity/actions/equity-actions.ts` and
`test/features/equity/equity-actions.test.ts`. `createTrade` at line 44 and
`updateTrade` at line 69 validate via parseOrThrow but discard the parsed value.
The schema trims and uppercases ticker input, yet the actions encrypt the raw
input with uppercase only. A crafted valid `' dbs '` stores `' DBS '`, misses
the SG alias and fails the quote/market consumers. Record a separate ordinary
batch to use the parsed object's fields in both write paths and add a regression
that decrypts persisted ticker ciphertext to the literal `DBS`. No migration or
dependency is needed, and the fix preserves the existing schema/public contract.
This proposal was implemented later under recorded Batch F.

### Recommended permission-gated SQL batches

- Vault throttle: a forward migration replacing unauthenticated success proof
  inside `vault_unlock_record` plus route/API integration changes. Acceptance:
  ordinary authenticated Data API cannot reset a lock, and concurrent attempts
  cannot bypass the budget. Preserve PIN/client derivation/cookie invariants.
- Household: a forward migration requiring invite-secret proof on consumption,
  serializing membership inserts on the household row, and enforcing one
  household per user. Corresponding household-action boundary regressions and
  concurrent SQL tests. Existing inconsistent memberships require owner-reviewed
  reconciliation, never blind deletion.
- Telemetry: a forward migration/trusted ingestion boundary that denies direct
  anonymous writes and unauthorized aggregate RPCs. Preserve anonymous non-PII
  marketing counts; test the actual Data API grants, not only the UI allowlist.

All three need separate owner authorization under constitution §7.4 because
schema/security-policy changes are outside ordinary audit remediation.

## Ledger rows

The rows below record first-pass source review. Keep means an active contract,
consumer, tooling entry point or historical database replay dependency exists.

<!-- prettier-ignore -->
| Path | Purpose | Observed consumers | Decision | Review depth / notes |
| --- | --- | --- | --- | --- |
| src/features/admin/index.ts | admin public module surface | src/app/dashboard/admin/page.tsx | Keep | Full barrel; source imports traced, no runtime bundling measured; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/admin/lib/compute-click-rate.ts | computeClickRate | test/features/admin/compute-click-rate.test.ts<br>src/features/admin/lib/get-marketing-stats.ts<br>src/features/admin/lib/compute-click-rate.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/admin/lib/get-marketing-stats.ts | getMarketingStats | src/app/dashboard/admin/page.tsx<br>src/features/admin/index.ts<br>src/features/admin/lib/get-marketing-stats.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/admin/types.ts | DailyPoint, MarketingTotals, MarketingStats | src/features/admin/types.ts<br>src/features/admin/lib/get-marketing-stats.ts<br>src/features/admin/index.ts<br>src/features/admin/components/stat-cards.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/assets/actions/planner-actions.ts | getPlannerSettings, upsertPlannerSettings | src/features/profile/hooks/use-export-data.ts<br>src/app/dashboard/(overview)/page.tsx<br>src/features/assets/actions/planner-actions.ts<br>src/features/assets/hooks/use-planner-settings.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/assets/actions/snapshot-actions.ts | getSnapshots, getSnapshot, upsertSnapshot, deleteSnapshot | src/app/dashboard/(overview)/page.tsx<br>src/features/assets/actions/snapshot-actions.ts<br>src/features/profile/hooks/use-export-data.ts<br>test/features/assets/snapshot-actions.test.ts | Keep | Full source/action tests; FD05/FD06; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/assets/constants.ts | CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, INVESTMENT_CATEGORIES | src/features/assets/schemas.ts<br>src/features/assets/hooks/use-chart-data.ts<br>src/features/assets/constants.ts<br>src/features/assets/components/summary-cards.tsx | Keep | Full source; semantic data and runtime consumers reviewed; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/assets/index.ts | assets public module surface | src/app/dashboard/assets/page.tsx<br>src/app/dashboard/(overview)/dashboard-overview.tsx<br>src/app/dashboard/(overview)/page.tsx<br>src/app/dashboard/entry/page.tsx | Keep | Full barrel; source imports traced, no runtime bundling measured; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/assets/lib/calculations.ts | calculateTotal, calculateMoMChange, getLatestSnapshot, getPreviousSnapshot | src/app/dashboard/assets/page.tsx<br>src/app/dashboard/(overview)/dashboard-overview.tsx<br>src/features/assets/lib/calculations.ts<br>src/features/assets/index.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/assets/lib/investment-math.ts | MarketBudget, MarketBudgets, Ratios, CashAlloc | src/app/dashboard/(overview)/dashboard-overview.tsx<br>src/features/assets/components/investment-breakdown.tsx<br>src/features/assets/components/investment-allocation.tsx<br>src/features/assets/components/index.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/assets/lib/salary-plan.ts | ceilToThousand, sumByCategory, calcAllTimeAvgExpense, SalaryPlanInput | test/features/assets/salary-plan.test.ts<br>src/features/assets/lib/salary-plan.ts<br>src/features/assets/components/salary-planner.tsx<br>src/features/assets/hooks/use-chart-data.ts | Keep | Full source; FD08/FD12, duplicate category sum; Pass 2: changed math/UI contract reviewed; red/green and full-suite proof |
| src/features/assets/schemas.ts | assetEntrySchema, snapshotFormSchema, SnapshotFormValues, plannerSettingsSchema | src/features/assets/schemas.ts<br>src/features/assets/components/snapshot-form.tsx<br>src/features/assets/actions/snapshot-actions.ts<br>src/features/assets/actions/planner-actions.ts | Keep | Full source; input boundary reviewed; FD13 or schema notes; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/assets/types.ts | AssetCategory, AssetEntryData, SnapshotData, SnapshotWithTotals | test/features/assets/calculations.test.ts<br>test/features/assets/summary-cards.test.tsx<br>src/features/profile/lib/export-data.ts<br>src/features/assets/types.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/auth/constants.ts | IDLE_LIMIT_MS, IDLE_CHECK_MS | test/features/auth/use-idle-lock.test.tsx<br>src/features/auth/index.ts<br>src/features/auth/hooks/use-idle-lock.ts<br>src/features/auth/constants.ts | Keep | Full source; semantic data and runtime consumers reviewed; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/auth/index.ts | auth public module surface | test/components/vault-gate.test.tsx<br>test/features/auth/use-idle-lock.test.tsx<br>src/app/dashboard/layout.tsx<br>src/app/(public)/login/page.tsx | Keep | Full barrel; source imports traced, no runtime bundling measured; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/auth/lib/email-login-schema.ts | emailLoginSchema, EmailLoginValues | src/features/auth/lib/email-login-schema.ts<br>test/features/auth/email-login-schema.test.ts<br>src/features/auth/components/email-login-form.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/actions/dividend-actions.ts | getDividends, createDividend, createDividends, updateDividend | test/features/equity/dividend-actions.test.ts<br>src/features/equity/hooks/use-dividends.ts<br>src/features/equity/actions/dividend-actions.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/actions/equity-actions.ts | getTrades, createTrade, updateTrade, deleteTrade | test/features/equity/equity-actions.test.ts<br>src/features/profile/hooks/use-export-data.ts<br>src/features/equity/actions/equity-actions.ts<br>src/features/equity/hooks/use-equity.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/actions/price-actions.ts | StockPrice, fetchStockPrices, fetchExchangeRate, fetchDividends | test/features/equity/price-actions.test.ts<br>src/features/equity/hooks/use-prices.ts<br>src/features/assets/lib/investment-math.ts<br>src/features/equity/components/dividend-form.tsx | Keep | Full source; FD14; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/index.ts | equity public module surface | src/app/dashboard/equity/page.tsx | Keep | Full barrel; source imports traced, no runtime bundling measured; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/lib/broker-fees.ts | FeeResult, BROKERS, Broker, calculateFees | src/features/equity/lib/broker-fees.ts<br>src/features/equity/components/trade-table.tsx<br>src/features/equity/components/trade-form.tsx<br>test/features/equity/broker-fees.test.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/lib/dividend-metrics.ts | toSGD, totalSGD, incomeByYear, ttmDistributionsSGD | src/features/equity/components/yield-on-cost-table.tsx<br>src/features/equity/lib/dividend-metrics.ts<br>src/features/equity/components/dividend-income-chart.tsx<br>src/features/equity/components/distributions-section.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/lib/dividend-scan.ts | DividendCandidate, buildDividendCandidates | test/features/equity/dividend-scan.test.ts<br>src/features/equity/lib/dividend-scan.ts<br>src/features/equity/components/dividend-scan-dialog.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/lib/dividend-suggest.ts | DividendPoint, sharesHeldAsOf, suggestAmount, nearestDpu | test/features/equity/dividend-scan.test.ts<br>test/features/equity/dividend-suggest.test.ts<br>src/features/equity/components/dividend-form.tsx<br>src/features/equity/lib/dividend-scan.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/lib/holdings.ts | Holding, computeHoldings | test/features/equity/dividend-metrics.test.ts<br>test/features/assets/investment-allocation.test.tsx<br>test/features/assets/investment-math.test.ts<br>test/features/equity/dividend-scan.test.ts | Keep | Full source/test consumers; FD10; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/lib/mwr.ts | CashFlow, computeIRR, buildCashFlows | test/features/equity/mwr.test.ts<br>src/features/equity/lib/mwr.ts<br>src/features/equity/components/portfolio-summary.tsx | Keep | Full source/test consumers; FD09; Pass 2: changed math/UI contract reviewed; red/green and full-suite proof |
| src/features/equity/lib/ticker-map.ts | getYahooSymbol, getMarket | test/features/equity/ticker-map.test.ts<br>src/features/assets/lib/investment-math.ts<br>src/features/assets/components/investment-breakdown.tsx<br>src/features/equity/lib/dividend-scan.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/lib/trade-form-defaults.ts | TradeFormValues, buildTradeFormDefaults | src/features/equity/lib/trade-form-defaults.ts<br>test/features/equity/trade-form-defaults.test.ts<br>src/features/equity/components/trade-form.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/schemas.ts | equityTradeInputSchema, dividendInputSchema | src/lib/validation/parse-or-throw.ts<br>src/features/equity/schemas.ts<br>src/features/equity/actions/equity-actions.ts<br>src/features/equity/actions/dividend-actions.ts | Keep | Full source; input boundary reviewed; FD13 or schema notes; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/equity/types.ts | TradeAction, EquityTradeData, DividendCurrency, DividendData | src/features/assets/lib/investment-math.ts<br>src/app/dashboard/equity/page.tsx<br>test/features/equity/trade-form-defaults.test.ts<br>test/features/equity/mwr.test.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/expenses/actions/expense-actions.ts | getExpenses, upsertExpense, deleteExpense, settleSplit | test/features/expenses/expense-actions.test.ts<br>src/app/dashboard/(overview)/page.tsx<br>src/features/profile/hooks/use-export-data.ts<br>src/features/expenses/actions/expense-actions.ts | Keep | Full source/action tests; FD05/FD06/FD17; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/expenses/constants.ts | EXPENSE_TYPES, EXPENSE_TYPE_LABELS, EXPENSE_TOTAL_EXCLUDED_TYPES, EXPENSE_TYPE_COLORS | src/features/expenses/schemas.ts<br>src/features/expenses/lib/utils.ts<br>src/features/expenses/lib/paste-parser.ts<br>src/features/expenses/lib/expense-table.ts | Keep | Full source; semantic data and runtime consumers reviewed; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/expenses/index.ts | expenses public module surface | test/features/assets/salary-plan.test.ts<br>src/features/assets/lib/salary-plan.ts<br>src/app/dashboard/(overview)/dashboard-overview.tsx<br>src/app/dashboard/(overview)/page.tsx | Keep | Full barrel; source imports traced, no runtime bundling measured; Pass 2: changed math/UI contract reviewed; red/green and full-suite proof |
| src/features/expenses/lib/expense-table.ts | SortKey, SortDir, ExpenseFilters, filterExpenses | src/features/expenses/components/expense-table.tsx<br>src/features/expenses/components/sortable-header.tsx<br>src/features/expenses/lib/expense-table.ts<br>src/features/assets/components/market-allocation-table.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/expenses/lib/owed.ts | MonthGroup, PersonGroup, buildPersonGroups | test/features/expenses/owed.test.ts<br>src/features/expenses/lib/owed.ts<br>src/features/expenses/components/owed-summary.tsx | Keep | Full source plus UI/test contracts; FD07; Pass 2: changed math/UI contract reviewed; red/green and full-suite proof |
| src/features/expenses/lib/paste-parser.ts | tryParseDate, tryParseCategory, ParsedRow, parsePastedRow | test/features/expenses/paste-parser.test.ts<br>src/features/expenses/lib/paste-parser.ts<br>src/features/expenses/components/expense-quick-add.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/expenses/lib/utils.ts | isCountedInExpenseTotals, generateId, buildSelfExpense, resolveSplitConfirm | src/features/assets/lib/salary-plan.ts<br>test/features/expenses/split-confirm.test.ts<br>src/features/expenses/components/editable-expense-row.tsx<br>src/features/expenses/components/expense-quick-add.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: changed math/UI contract reviewed; red/green and full-suite proof |
| src/features/expenses/schemas.ts | expenseSplitSchema, expenseDataSchema | src/features/expenses/schemas.ts<br>src/features/expenses/actions/expense-actions.ts | Keep | Full source; input boundary reviewed; FD13 or schema notes; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/expenses/types.ts | ExpenseType, ExpenseSplitData, ExpenseData | test/features/expenses/expense-actions.test.ts<br>test/features/expenses/expense-table.test.ts<br>test/features/expenses/owed.test.ts<br>test/features/expenses/use-expenses-options.test.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/household/actions/goal-actions.ts | getGoals, createGoal, addContribution, deleteGoal | test/features/household/goal-actions.test.ts<br>src/features/household/index.ts<br>src/features/household/hooks/use-household.ts<br>src/features/household/components/goal-list.tsx | Keep | Full source/migration correlation; FD04/FD06/FD13/FD17; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/household/actions/household-actions.ts | createHousehold, getHousehold, unlockHousehold, createInvite | test/features/household/household-actions.test.ts<br>src/features/household/index.ts<br>src/features/household/types.ts<br>src/features/household/hooks/use-household.ts | Keep | Full source/action tests and migration correlation; FD02–FD04; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/household/constants.ts | INVITE_TTL_HOURS, HOUSEHOLD_MEMBER_CAP | src/features/household/constants.ts<br>src/features/household/actions/household-actions.ts | Keep | Full source; semantic data and runtime consumers reviewed; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/household/index.ts | household public module surface | src/app/dashboard/household/page.tsx | Keep | Full barrel; source imports traced, no runtime bundling measured; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/household/lib/goal-progress.ts | GoalProgress, computeGoalProgress | test/features/household/goal-progress.test.ts<br>src/features/household/actions/goal-actions.ts<br>src/features/household/lib/goal-progress.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/household/schemas.ts | createHouseholdSchema, acceptInviteSchema, createGoalSchema, addContributionSchema | src/features/household/schemas.ts<br>src/features/household/actions/household-actions.ts<br>src/features/household/actions/goal-actions.ts | Keep | Full source; input boundary reviewed; FD13 or schema notes; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/household/types.ts | HouseholdRole, HouseholdSummary, CreateHouseholdResult, InviteResult | src/features/household/actions/goal-actions.ts<br>src/features/household/actions/household-actions.ts<br>src/features/household/components/add-contribution-dialog.tsx<br>src/features/household/components/goal-list.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/marketing/constants.ts | MarketingFeature, FEATURES, MoatPoint, MOAT_POINTS | test/features/marketing/constants.test.ts<br>src/features/marketing/constants.ts<br>src/features/marketing/components/faq.tsx<br>src/features/marketing/components/feature-grid.tsx | Keep | Full source; semantic data and runtime consumers reviewed; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/marketing/fonts.ts | fraunces | test/features/marketing/hero.test.tsx<br>src/features/marketing/fonts.ts<br>src/features/marketing/components/cta-band.tsx<br>src/features/marketing/components/hero.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/marketing/index.ts | marketing public module surface | src/app/(public)/page.tsx | Keep | Full barrel; source imports traced, no runtime bundling measured; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/marketing/lib/track.ts | trackEvent | src/features/marketing/lib/track.ts<br>src/features/marketing/components/page-view-tracker.tsx<br>src/features/marketing/components/tracked-cta-link.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/profile/actions/profile-actions.ts | getProfile, upsertProfile | test/features/profile/profile-actions.test.ts<br>src/features/profile/actions/profile-actions.ts<br>src/features/profile/hooks/use-profile.ts<br>src/features/profile/hooks/use-export-data.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/profile/index.ts | profile public module surface | src/app/dashboard/profile/page.tsx | Keep | Full barrel; source imports traced, no runtime bundling measured; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/profile/lib/export-data.ts | EXPORT_VERSION, TaxReliefExport, ExportData, ExportEnvelope | test/features/profile/export-data.test.ts<br>src/features/profile/lib/export-data.ts<br>src/features/profile/hooks/use-export-data.ts | Keep | Full source/export hook correlation; FD15; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/profile/schemas.ts | profileSchema, ProfileFormValues | src/features/profile/schemas.ts<br>src/features/profile/components/profile-form.tsx<br>src/features/profile/actions/profile-actions.ts | Keep | Full source; input boundary reviewed; FD13 or schema notes; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/profile/types.ts | ResidencyStatus, ProfileData | src/features/profile/types.ts<br>src/features/profile/lib/export-data.ts<br>src/features/profile/index.ts<br>src/features/profile/hooks/use-profile.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/salary/actions/relief-actions.ts | getTaxReliefs, getAllTaxReliefs, upsertTaxReliefs | test/features/salary/relief-actions.test.ts<br>src/features/salary/hooks/use-tax-reliefs.ts<br>src/features/profile/hooks/use-export-data.ts<br>src/features/salary/actions/relief-actions.ts | Keep | Full source; FD05/FD06; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/salary/actions/salary-actions.ts | getSalaryRecords, getSalaryRecord, upsertSalaryRecord, deleteSalaryRecord | src/features/salary/hooks/use-salary.ts<br>src/app/dashboard/(overview)/page.tsx<br>test/features/salary/salary-actions.test.ts<br>src/features/salary/actions/salary-actions.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/salary/constants.ts | TAX_BRACKETS, NON_RESIDENT_RATE, CPF_EMPLOYEE_RATE, CPF_MONTHLY_CEILING | src/features/salary/constants.ts<br>src/features/salary/lib/tax-reliefs.ts<br>src/features/salary/lib/tax-cpf.ts<br>test/features/salary/relief-row.test.tsx | Keep | Full source; semantic data and runtime consumers reviewed; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/salary/index.ts | salary public module surface | src/app/dashboard/(overview)/page.tsx<br>src/app/dashboard/salary/page.tsx<br>src/app/dashboard/(overview)/dashboard-overview.tsx | Keep | Full barrel; source imports traced, no runtime bundling measured; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/salary/lib/tax-cpf.ts | getEarnedIncomeRelief, TaxProfileContext, computeAutoReliefs, calculateTax | test/features/salary/tax-cpf.test.ts<br>src/features/salary/lib/tax-cpf.ts<br>src/features/salary/hooks/use-salary-ytd-stats.ts<br>src/features/salary/components/salary-summary.tsx | Keep | Full source/test and IRAS/CPF research; FD11/FD12; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/salary/lib/tax-reliefs.ts | ReliefState, ReliefStateMap, buildInitialState, buildReliefItems | test/features/salary/tax-reliefs.test.ts<br>src/features/salary/lib/tax-reliefs.ts<br>src/features/salary/components/tax-reliefs-dialog.tsx<br>src/features/salary/components/relief-row.tsx | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/salary/schemas.ts | salaryDataSchema, taxReliefDataSchema | src/features/salary/schemas.ts<br>src/features/salary/actions/salary-actions.ts<br>src/features/salary/actions/relief-actions.ts | Keep | Full source; input boundary reviewed; FD13 or schema notes; Pass 2: detailed source reread; runtime proof limited to existing suite |
| src/features/salary/types.ts | SalaryData, TaxReliefData, ReliefVariant, ReliefDefinition | src/features/salary/types.ts<br>src/features/salary/lib/tax-reliefs.ts<br>src/features/salary/index.ts<br>src/features/salary/hooks/use-tax-reliefs.ts | Keep | Full source; consumer references traced; no additional confirmed finding; Pass 2: detailed source reread; runtime proof limited to existing suite |
| supabase/migrations/20260411150000_init.sql | Ordered database schema/policy lifecycle: init | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260413000000_add_vault_check.sql | Ordered database schema/policy lifecycle: add_vault_check | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260414000000_add_profile_insert_policy.sql | Ordered database schema/policy lifecycle: add_profile_insert_policy | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260527000000_add_vault_v2.sql | Ordered database schema/policy lifecycle: add_vault_v2 | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260528000000_fix_rekey_id_text.sql | Ordered database schema/policy lifecycle: fix_rekey_id_text | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260528010000_drop_rekey_rpc.sql | Ordered database schema/policy lifecycle: drop_rekey_rpc | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260528020000_drop_backup_tables.sql | Ordered database schema/policy lifecycle: drop_backup_tables | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260602000000_add_vault_unlock_throttle.sql | Ordered database schema/policy lifecycle: add_vault_unlock_throttle | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260611000000_add_marketing_telemetry.sql | Ordered database schema/policy lifecycle: add_marketing_telemetry | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260615000000_add_equity_dividends.sql | Ordered database schema/policy lifecycle: add_equity_dividends | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260616000000_add_trade_cdp_po.sql | Ordered database schema/policy lifecycle: add_trade_cdp_po | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260626000000_add_household.sql | Ordered database schema/policy lifecycle: add_household | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260627000000_add_household_goals.sql | Ordered database schema/policy lifecycle: add_household_goals | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/migrations/20260705000000_fix_household_creator_select.sql | Ordered database schema/policy lifecycle: fix_household_creator_select | Supabase migration replay; feature actions and later migrations | Keep historical | Full SQL review; no replay or live RLS proof; current findings FD01–FD04/FD16 where applicable; Pass 2: SQL grants/RLS/definer static rescan; no database replay |
| supabase/config.toml | Local Supabase service/auth/API defaults | Supabase CLI local runtime | Keep | Full config; not evidence of production settings; max_rows FD06; Pass 2: row-limit/local-scope correlation; no production inspection |

## Completed detailed second pass and batches F/I

All 64 current feature source files were reread in full in pass 2, after consumer tracing. The 14 migrations and config received full pass 1 reads and static policy/grant/config correlation in pass 2; SQL exploit scenarios remain unexecuted and require local integration proof. No source deletion candidate was proven.

Batch F uses parsed normalized trade fields in both write paths, validates bounded ticker arrays and external quote/FX/dividend data with Zod, limits quote requests to five concurrent workers, and applies ten-second AbortSignal timeouts. It preserves fallback results and stable canonical output. Regression run: 22 failed / 29 passed before remediation; 51 passed afterward. FD14 and the ticker-normalization proposal are now remediated. Full typecheck and scoped lint passed.

Batch I preencrypts replacement children before parent mutation, awaits parent success before deletion, checks delete errors, and inserts only after successful deletion. Regression run: 5 failed / 32 passed before remediation; 37 passed afterward. FD05 is partially remediated: insert failure and concurrent replacement still require a separately authorized atomic database operation. No transaction guarantee is claimed.

Snapshot primary-key update risk remains a concrete follow-up hypothesis: upsert submits a fresh id on conflict(user_id, month), while existing asset_entries reference the prior id with no ON UPDATE CASCADE. Replay an existing populated month against local Postgres/PostgREST before selecting a compatibility-safe id-preservation fix; this batch deliberately does not change primary-key semantics.

<!-- prettier-ignore -->
| Additional current file | Purpose | Consumers | Decision | Review depth |
| -------------------------------- | ------------------------------------ | --------------------------------------- | -------- | ------------------------------------------------------------------ |
| src/features/equity/constants.ts | Bound quote work/concurrency/timeout | price-actions.ts, price-actions.test.ts | Keep | Full implementation and detailed pass2 review; regression coverage |

Final focused F/I verification: four test files, 88 tests passed after the ISO-year bound refinement. Scoped Batch I ESLint passed with zero warnings. Full shared suite snapshot during parallel red-green work: 80 files / 537 tests passed; four files / nine tests failed in expense rollback/lifecycle, export lifecycle and the marketing copy expectation. Those failures are owned by concurrent root/other-agent batches; this report does not claim final whole-repository gates are green.

## Batch N: asynchronous invite derivation

The recorded four-path batch changed deriveInviteKey to callback-based crypto.pbkdf2 wrapped in a Promise and awaited create/accept plus test callers. Salt decoding, 600,000 iterations, SHA-256, 32-byte output and wrapped-key envelope are unchanged. A fixed vector captured before the change remains byte-identical: secret audit-invite-fixture, salt AAECAwQFBgcICQoLDA0ODw==, key ae89c6be9426fd81662901f0f92f276f4a47a1805265e2423904750e3eda1d61. Regression red: one failed/11 passed; final crypto/action focused suite:23 passed. Scoped lint and full typecheck passed.

A local single-run scheduling comparison measured sync setImmediate delay163ms/total163ms versus async delay39ms/total190ms. This demonstrates freed event-loop scheduling in this run; it does not establish improved total derivation latency or throughput. The regression asserts scheduled work runs before async derivation settles. [Node documentation](https://nodejs.org/api/crypto.html#cryptopbkdf2password-salt-iterations-keylen-digest-callback) confirms asynchronous PBKDF2 uses the libuv threadpool; worker-pool saturation remains a capacity concern. No crypto protocol or snapshot primary-key change was made.

Batch N supplemental provider-error regression rejects with the original PBKDF2 error and restores its spy in finally. Crypto/action focused tests:24 passed. Scoped household-key V8 coverage:100% statements(11/11), branches(2/2), functions(8/8), lines(10/10);13 tests passed. This is scoped coverage, not a whole-repository coverage claim.

## Batch T: real equity UI behavior and runtime remediation

Added test/features/equity/equity-ui.test.tsx using real dialogs, tables, chart, calculation helpers, hooks and QueryClientProvider. Mocks are external server actions/market fetches/toast, with measured DOMRect and ResizeObserver browser fixtures; component internals are not mocked. Behavior covers saved/new trades, broker selection and fee override, pending/errors, actual distribution suggestions/no-data/no-shares/network cases, scan selection/amount edits/import/error/cancellation, table pagination/edit/confirmation, quote loading/missing/error, gain/loss and FX keyboard toggle, query errors, yield sorting/filtering, and distributions composition/chart year axis.

Independently reproduced and fixed two narrow runtime failures after recording exact source paths: cleared trade date produced an unhandled RangeError before feedback (one red regression); rejected trade/distribution deletion produced two unhandled rejections and no feedback (two red regressions). Date guard and opaque deletion-failure toasts preserve valid mutations and existing model/currency contracts.

Final focused equity run:14 files /166 tests passed, with25 new UI behavioral tests. Unique coverage output:coverage/equity-batch-t; statements99.09%(660/666), branches93.39%(424/454), functions98.49%(196/199), lines99.66%(598/600). Coverage denominator/exclusions/floors unchanged. Chart tooltip formatting remains unexercised; jsdom chart prints its initial premeasurement warning even though the real chart later renders the asserted year axis. This is domain coverage and simulated browser execution, not live Supabase/RLS or browser E2E proof.

Batch T scoped lint and full typecheck passed. Fresh independent continuation review read root snapshot edit-ID preservation, SonarJS configuration, auth sign-out/export lifecycle, profile query form, admin aggregate authorization, marketing telemetry/navigation sources and their behavioral suites. No new regression confirmed in these changes. Two residual limits remain actionable: TrackEventSchema accepts arbitrary path strings, so user identity embedded in path can still be stored despite tests proving extra identity fields are stripped (src/lib/validation/track-event.ts:12; src/app/api/track/route.ts:28). Snapshot ID preservation applies when originalId is supplied; creation for an existing month still uses a fresh UUID upsert on user_id/month and needs FK-aware local DB proof. New mocks prove handler/UI contracts, not live RLS/admin RPC restrictions, native browser navigation, or complete historical export beyond Data API row limits.

Continuation privacy follow-up: six API regressions proved query/fragment/private/absolute/backslash/control paths were persisted202 before fix. TrackEventSchema now accepts only supported public marketing '/' and '/login' paths. API/schema/real storefront tests:21 passed, no database access or private value reflection for rejected input. Direct Data API insertion policy remains unresolved. Snapshot frontend duplicate-submit guard was recorded and added without backend changes: one red regression then nine passing snapshot UI tests (existing unique/edit flows plus bypass guard). Query-fed UI protection does not solve concurrent sessions or truncated history. Independent root continuation verification: eight files/53 tests passed.

## Spec071 household database remediation

Owner-approved follow-up implemented `supabase/migrations/20261008000001_household_authorization.sql` with actual PostgreSQL17 fixture evidence. FD02–04 now have database-level regression proof: legacy UUID-only RPC denied; secret-derived hash verified inside transactional consumption; parent row version serializes INSERT/UPDATE capacity checks; one-user membership uniqueness rejects racing joins. Owner-only invite policies and narrowed UPDATE grants prevent member role, creator identity and invite proof mutation through authenticated table access. Existing conflicting memberships or capacity abort migration without deleting records.

New integration scripts `test/security/household-authorization.sql`, `test/security/household-concurrency.ps1`, and `test/security/household-conflicts.sql` pass real anon/authenticated role negative cases, legitimate owner bootstrap/join, privileged UPDATE cap, READ COMMITTED/REPEATABLE READ distinct-invite races, same-user cross-household race and actual preflight conflict branches. Historical baseline reproduced UUID-only authorization failure before applying the migration. Tests use credentialless disposable localhost PostgreSQL only; production/staging application remains separate owner scope. This adds one reviewed forward migration beyond the original 79-file audit inventory; original historical SQL review claims remain unchanged.

Independent current root SQL review (`20261008000000_security_rpc_boundaries.sql`): no actionable authorization regression found in reservation/finish privilege split or public-page telemetry allowlist. Trusted service-role RPC ownership and application fail-closed integration still require final root gates; review performed while root caller edits were in progress, so this is SQL-level review rather than deployment approval.

Portable reproduction is now `node scripts/test-security-sql.mjs --pg-bin <installed PostgreSQL bin> --data-dir <new disposable directory> --port 55472`. The Node household module supersedes the removed PowerShell runner. A complete fresh PG17.10 lifecycle passed both real-role SQL suites, actual preflight conflicts, three observed-lock household races, six simultaneous vault reservations (five accepted tokens), abandoned/deadline accounting, consumed-token replay, elapsed-window recovery and pending failure preservation after valid success. Shutdown and absence of postmaster pid were verified; logs/data retained. This intentionally models only relevant identity/role/schema contracts and does not claim a full Supabase Auth or production deployment test.
