---
id: '104'
area: audit
status: draft
created: 2026-10-10
author: Codex
constitution_satisfies: ['§1.1', '§2.3', '§3.2', '§4', '§7.4', '§8.2']
---

# Draft104: scan estimates must not become unconfirmed receipts

Read-only proposal, 2026-10-10; not implementation authorization. Inspected
batch099 source based on merged main `13dd5b5` and draft080 at main `cc4cc2d`.
No product, schema, provider, dependency or crypto change made.

## Evidence

`src/features/equity/lib/dividend-scan.ts` builds gross estimates from feed ex-date,
DPU and reconstructed shares. It suppresses candidates by existing ticker/date,
but `DividendData.date` in `types.ts`, the dividend schema/actions and the SQL table
mean payment date. A receipt on2026-06-15 does not identify an event ex-dated
2026-06-01. A legacy estimate saved on the ex-date is also indistinguishable from
a genuine payment on that date.

`components/dividend-scan-dialog.tsx` initially selects every candidate, permits
amount editing, and maps `date:r.date` unchanged into `createMany.mutateAsync`.
It cannot edit payment date or currency. Blank amounts become0; import silently
filters selected invalid amounts while the button count still counts them.
The explanatory ex-date/gross caveat is visible but does not change persisted
received-income semantics. `createDividends` supplies random IDs; no durable
event identity or repeat-import idempotency exists.

## Smallest truthful no-schema shape

Keep the feed ex-date visible as evidence. Review one candidate at a time using
the existing received-payment editor pattern, or a narrow review panel rather
than adding several cramped basic-input columns to the current modal. Require:

- Actual payment date, initially blank; never prefill the source ex-date.
- Actual received amount as an editable draft string, initially blank; retain
  gross estimate separately and visibly. Blank/invalid values show inline errors,
  never silently drop selected rows.
- Explicit actual currency selection, with the ticker-inferred estimate labelled
  separately; unknown or changed currency must not undergo guessed conversion.
- Unchecked confirmation that this is a received payment checked against the
  user's statement. No unattended or default-selected received write.

This can make a newly saved receipt truthful without new columns, provided it
uses ordinary manual receipt writes and makes no claim to have persisted an
expected event or source verification. It must not write gross estimates merely
because a user opened the scan.

## Dedupe and legacy decision required

Do not retain ticker/ex-date suppression as evidence that an event is paid.
Show existing same-ticker receipts as possible matches with date/native currency/
amount; users decide, with no automatic merge, delete or proof of a match.
Even a date+amount match is not unique across brokers/partial payments. Legacy
rows remain user-recorded with unknown provenance; no automatic reclassification.

Without persisted event-to-receipt identity, rescan cannot reliably suppress
confirmed events or guarantee repeat-save dedupe. A client-only warning/confirmation
does not solve concurrent imports or uncertain network outcomes. Therefore104
must not promise “all recorded,” “reconciled,” or retry-safe imports. Root must
decide whether a truthful one-receipt review is worth shipping with this visible
limitation, or defer scanner writes entirely until approved080 persistence.

Recommendation: avoid expanding the batch importer now. Prefer the narrow actual
receipt review above only if root accepts the residual identity limitation and
records it before edits. Otherwise keep104 draft and pursue concrete080 event/
receipt persistence. Do not certify the existing batch import by adding only a
checkbox: that leaves wrong dates and misleading dedupe intact.

## Required proof before any implementation

Mounted meaningful reds: ex-date differs from payment date; no default confirmation;
blank payment date/net amount cannot save; actual currency can differ; rejected
write preserves edits and does not claim received; successful write receives only
actual fields. Verify manual same-ticker payment-date records are not silently
hidden, legacy ex-date rows remain ambiguous, duplicate-valued broker payments are
not merged, and closed/reopened async jobs cannot affect a new review. Security/
auth/vault/RLS boundaries unchanged, all gates and coverage floors, independent
review and desktop/mobile/keyboard actual-component proof required.

[SGX issuer event example](https://links.sgx.com/1.0.0/corporate-announcements/V8MIFM7JCL89DE7H)
shows separate ex/record/pay dates and declared currency/rate; it does not establish
an individual account's received amount. Draft080 remains unapproved for source
access and status/event persistence. No private statement or actual provider call
was used in this investigation.

## Root scope decision

No implementation selected: making an actual receipt review truthful does not resolve the current event/payment identity, uncertain retry and legacy provenance contracts. Keep this reviewable proposal alongside draft080 and do not certify batch imports by adding only a checkbox.
