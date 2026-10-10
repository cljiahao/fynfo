---
id: '080'
slug: dividend-source-and-reconciliation
area: feature
status: draft
author: Codex
created: 2026-10-09
approved:
shipped:
impl_pr:
supersedes:
constitution_satisfies:
  ['§2.1', '§2.2', '§2.3', '§2.4', '§3.1', '§4', '§5', '§7.4', '§8.3']
constitution_overrides: []
---

# Spec080: Announced dividend evidence and received-payment reconciliation

## Problem

Clarence requested automatic dividend extraction, specifically asking about
dividends.sg on2026-10-09. Existing shipped042 already scans Yahoo ex-dates/DPU
and estimates amounts from shares, but only considers current holdings. A fully
sold position is omitted from historical scanning. Ex-date is used as a record
date and ticker/date dedupe can miss a manual payment-date record. Public company
announcements cannot establish an account's actual net cash receipt.

## Constitution check

Keep encrypted dividend writes and existing auth/vault/RLS boundaries. Reuse the
scanner and review form; do not duplicate the ledger. Client-side local statement
review is covered by draft079 and is not automatically implemented here. Provider
license/API, paid services, dependencies and any persisted new dividend status/
event-reference fields need scoped approval. No permission or amendment is assumed.

## Solution shape

Proposed paths: equity `lib/dividend-scan.ts`, `lib/dividend-suggest.ts`,
`components/dividend-scan-dialog.tsx`, dividend form/actions/hooks, approved public
market integration adapter, synthetic tests and README. New fields or tables are
outside executable scope until a concrete migration is approved.

- Scan historical trade tickers, including sold positions, within an explicit
  date range. Review entitlement logic against market-specific official rules:
  same-ex-date buys must not be indiscriminately included; special distributions,
  corporate actions and unknown holdings history require visible uncertainty.
- Display announced DPU, currency, ex/record/payment dates when available,
  corporate-action reference/source link and retrieval date. Never substitute
  ex-date for unknown payment date. Distinguish announcement facts from expected
  amounts derived from trade history and from user-confirmed received payments.
- A synthetic example: announced0.10/share with1000eligible shares suggests100
  gross. A reviewed broker/CDP/bank credit establishes the recorded amount and
  currency; fees, withholding, FX and cash/scrip choices may cause differences.
  Do not infer ownership eligibility solely from a current holdings count.
- Show candidates automatically when users open distribution review, with bounded
  requests and explicit failed/unavailable sources. No unattended income writes.
  Missing feed data is not “everything recorded”. Editing date/currency/amount
  and rejecting a candidate remain available before save.
- Reconcile statements through the local side-by-side review contract079.
  Match issuer/ticker, source event and relevant date/amount, with ambiguous
  matches left for users. Multiple brokers/partial receipts must not be silently
  collapsed by ticker/date. Saving an estimate must not inflate confirmed income.
  Persisting expected/confirmed distinctions requires a separate schema proposal
  if the current ledger cannot represent them truthfully.
- Dividends.sg is a possible evidence source only after a permitted integration
  contract. Its indexed terms require prior written authorization for automated
  extraction, including site endpoints. No scraper, headless collection or guessed
  API endpoint is implemented. Evaluate licensed feeds or permitted SGX/issuer
  announcement access independently; public availability alone does not establish
  automation rights. Provider costs need owner approval.

## Out of scope

No broker/CDP login, unattended purchases/payments, external financial-file upload,
unlicensed scraping, investment advice or guaranteed net cash calculation. No new
dependency, migration, paid provider or crypto change without scoped approval.

## Acceptance

- Sold-position history, entitlement boundary dates, missing feeds, manual
  payment-date matches, multiple broker receipts and special events have synthetic
  regression tests. Wrong/ambiguous market data cannot create confirmed receipts.
- Source and status are visible; currency/date/amount remain editable; failed
  scans and saves preserve review state. No duplicates on repeated review/save.
- pnpm check, test:ci and build pass in isolated synthetic fixtures; coverage
  above80% in every aggregate metric, stricter security floors unchanged.
- Second review checks source licensing, event identity, entitlement assumptions,
  encryption and README/comments before green CI and authorized PR/merge.

## Risk & reversibility

Wrong event matching can overstate income or hide receipts. Keep announced events
outside confirmed totals until explicit reconciliation. Revert UI/adapter code to
remove scanning; existing dividend records remain intact. Any eventual schema
change must have its own forward-only migration and rollout/rollback contract.

## Open questions

- Permitted source/API/license remains unverified; owner/provider written access
  agreement is needed for dividends.sg automation. No outreach was sent.
- Separate payment and ex-dates/status/source IDs likely need schema approval;
  prepare the concrete model before implementing persistence.
- Broker/CDP statement adapters need synthetic/public layouts and overlap handling;
  do not request or access confidential live records.

## Research

[Dividends.sg example event fields](https://www.dividends.sg/view/D05),
[Dividends.sg terms](https://www.dividends.sg/terms),
[SGX corporate actions](https://www.sgx.com/securities/corporate-actions),
[SGX disclosure rules](https://rulebook.sgx.com/rulebook/part-ii-equity-securities-immediate-announcements),
[Investor.gov entitlement dates](https://www.investor.gov/introduction-investing/investing-basics/glossary/ex-dividend-dates-when-are-you-entitled-stock-and).
Dividends.sg direct opens failed in the research tool; indexed site excerpts
provided fields and the automation restriction. No permission was inferred.

## Delivery boundary — 2026-10-10

The original current-holdings-only limitation above describes the pre090 baseline. Spec090 shipped in PR20: historical scanning now includes sold tickers and uses the strict ex-date purchase boundary. Its existing five-year feed, ticker-inferred currency, ex-date/payment-field mismatch and provider-empty-on-error behavior remain recorded limitations; that estimate correction does not establish actual received payments or satisfy this source/status/reconciliation proposal.

A fresh primary-source terms search on2026-10-10 found the Dividends.sg terms dated30September2026 still require prior written authorization for automated access/extraction, including personal/internal use and site endpoints. Direct research-tool opens failed; the site's indexed terms supplied the permission contract. No dividend dataset was collected, scraper implemented, provider contacted or permission inferred. The draft remains unapproved for integration and persistence changes.
