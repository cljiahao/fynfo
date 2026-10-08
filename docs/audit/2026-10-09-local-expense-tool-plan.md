# Local expense preparation plan

Status: planned, not installed or implemented. Owner authorized the recommended sequence on2026-10-09. Finish the Fynfo loading/error fixes first; prepare this separate personal workflow afterward. No statements or credentials were accessed.

## Recommendation

Use the existing PC for a local monthly workflow. Keep the tool outside Fynfo, with no Supabase credentials or direct writes. Preserve the statement-upload removal in shipped spec022 and constitution§1.2. Regulatory acceptability is not established by that repository decision.

Start with a pinned Monopoly CLI version tested on synthetic fixtures, then one bank/statement format the owner runs locally. Its maintained [documentation](https://github.com/benjamin-awd/monopoly) lists Singapore banks, JSON output with transaction IDs, and default totals validation. The package is distributed as [monopoly-core](https://pypi.org/project/monopoly-core/). Published support is not proof that a particular statement parses correctly. Keep the third-party CLI separate; review its AGPL licence and dependencies before any installation or distribution. Separate execution alone is not a licence exemption.

## Data contract

Retain original statements privately outside repositories. Store normalized transactions in a local SQLite ledger with CSV export for portability. Each row needs source digest, statement/account identity, transaction ID, transaction/posting date, integer minor-unit amount, currency, debit/credit direction, description, parser name/version, review status, and transfer/refund classification. Store a schema version and migration history. Preserve original extracted data alongside corrected categories so reparsing does not overwrite reviewed decisions.

Deduplicate by source statement and stable transaction identity. Equal merchant/date/amount alone is insufficient: legitimate repeated transactions must survive. Reconcile separate debit/credit totals and opening/closing balance where available using exact minor-unit arithmetic. A failed or unavailable reconciliation blocks paste output and identifies what the owner must review. Never combine currencies into one amount or assume all positive statement values are expenses.

Use a rules table for merchant/category mappings and retain corrections locally. Flag own-account transfers and card-bill payments for review to prevent double counting. Refunds and unsupported currencies stay visible for review rather than being silently discarded or converted into positive spending.

## Fynfo handoff

Output only owner-reviewed spending rows as tab-separated date, expense type, item, info and amount. Use yyyy-MM-dd, the existing14 expense-type keys, positive supported-currency amounts, and sanitized single-line text without tabs. The existing Fynfo parser uses content heuristics rather than strict column positions, so test actual parser results before treating this as a stable import API.

Review happens **before** paste: quick-add may save immediately. Fynfo does not accept the ledger's transaction ID or enforce bank-transaction deduplication. Keep a local handoff manifest, and mark rows as confirmed only after the owner verifies successful saves. Partial failures require explicit reconciliation; never automatically repaste an entire batch. This is a manual handoff, not an atomic or guaranteed exactly-once import.

The browser derives the vault key; Fynfo's server receives it through a sealed HttpOnly cookie for authorized encryption/decryption. The local tool must not retrieve that cookie/key or bypass authenticated server actions.

## Synthetic acceptance cases

- Exact reconciliation success and one-cent mismatch; absent or contradictory totals.
- Same source rerun; reissued statements; two genuinely identical purchases.
- Expense plus refund; own-account transfer; credit-card payment appearing in two accounts.
- Multiple currencies; invalid dates; ambiguous numeric merchant descriptions; embedded tabs/newlines.
- Reviewed category surviving reparse; unknown category held for review.
- Actual Fynfo paste-parser roundtrip against generated rows; partial save failure and uncertain handoff status.
- No outbound statement upload, secret-file reads, direct database writes or personal-data logs.

## Remaining decisions

The owner's banks/cards and statement variants have not been supplied. Dependency version, packaging and local operating instructions should be finalized only after those formats are known and an installation review is complete. No new hardware, model service, email-alert integration or Fynfo schema change is proposed for the first iteration.
