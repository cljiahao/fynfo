---
id: '181'
slug: bank-statement-layouts
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-08
approved: 2026-11-08 # YYYY-MM-DD, set on approval
shipped: # YYYY-MM-DD, set on impl merge
impl_pr: # no PR (direct to main), set on shipped
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.2'
  - '§2.3'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§5.1'
  - '§5.3'
  - '§5.4'
  - '§6.3'
constitution_overrides:
---

# Spec 181: Qualified statement layouts for DBS, Citibank, HSBC and DBS PayLah

## Problem

The statement import (specs 079, 133, 135, 154) can only read one bank properly.
`parseStatementLines` in `src/features/import-review/lib/statement-parser.ts`
has a UOB-specific header detector (the two-date `Post Date / Trans Date /
Description of Transaction / Transaction Amount SGD` table, with `Ref No:` and
foreign-currency continuation lines). Every other bank falls through a generic
heuristic that expects a leading date and a `SGD billed` wording. That heuristic
has no real-layout tests behind it: the DBS/HSBC/Citibank tests in
`test/features/profile/statement-parser.test.ts` use one-line synthetic rows such
as `20 DEC MARKET SGD 15.00`, and the parser's own doc comment says bank selection
never establishes layout support. In practice the owner's DBS statement import
fails. The likely cause, from the owner's redacted DBS layout: the DBS
transaction header reads `DATE DESCRIPTION AMOUNT (S$)`, which does not match
the `billedSgd` regex (it needs `SGD`/`S$` next to `BILLED` or `AMOUNT` in a
specific order), so qualified rows are never treated as billed SGD amounts.
Citibank's header, `DATE DESCRIPTION AMOUNT (SGD)`, has the same gap. DBS PayLah, a separate wallet statement the owner also uses, is not a
selectable source at all, and its text would also match the DBS identity regex.

The owner wants all four sources to import their real statements the way UOB
does: rows read correctly, summary and repayment lines excluded, foreign-currency
lines never guessed, and any layout the parser does not recognise still failing
visibly rather than producing wrong expenses.

## Constitution check

- Satisfies: `§2.1` and `§5.1` (PDF text is read and parsed locally in the
  browser; nothing new is sent to Supabase, no PIN or DEK handling changes),
  `§2.2` and `§2.3` (saving still goes through the existing import server
  action, unchanged guard order), `§2.7` (named exports only in the new layout
  modules), `§3.1`/`§3.2` (no new dependency; `pdfjs` extraction is unchanged),
  `§3.4` (kebab-case file names), `§4.1`/`§4.2` (all gates pass; every layout is
  covered by fixture tests, and each bank ships with a regression test for the
  DBS failure and the unknown-layout failure), `§5.3` (no secrets involved),
  `§5.4` (the bank value only appears inside already-encrypted payloads, never
  as a queryable column), `§6.3` (no migration, so nothing to roll forward).
- Overrides: none. No `HARD` rule is touched.

Privacy rule for fixtures (derived from `§1.1` and `§2.1`): real statements are
never committed, attached to a PR, or pasted into specs or tests. Fixtures are
synthetic and hand-built to mirror layouts the owner supplies in redacted form.
This matches the existing `docs/audit/pdf-import-fixtures/` convention
(`supportedBankClaim: false`, "NOT A REAL STATEMENT").

## Solution shape

Scope decision: all four sources (DBS, Citibank, HSBC, DBS PayLah) are in
scope. UOB behaviour is unchanged and must not regress.

### Bank model

- `StatementBank` in `src/features/import-review/types.ts` gains `'paylah'`
  (`'uob' | 'dbs' | 'hsbc' | 'citibank' | 'paylah'`).
- `STATEMENT_BANKS` in `src/features/import-review/constants.ts` gains a PayLah
  entry labelled `DBS PayLah`.
- Identity regexes need a discriminator. `/\bDBS\b|\bPOSB\b/i` also matches
  PayLah text, so a DBS-selected parse of a PayLah statement (and the reverse)
  would otherwise be accepted. The owner's PayLah sample contains both
  `PayLah!` and `DBS Bank Ltd`, so DBS identity matches it too. The
  discriminator is `PayLah!`: PayLah identity matches `PayLah!`, and the DBS
  identity check must reject any text containing `PayLah!` (so the PayLah test
  runs before DBS). The `paylah` entry sits before `dbs` where order matters.
- Add tests that a PayLah text under `dbs` and a DBS text under `paylah` both
  throw the existing "selected bank could not be identified" error.

### Layout modules

Today the UOB logic is inline in `parseStatementLines` (header detection about
lines 339-353, continuation rules in the grouping loop at 355-389). To keep later
slices from colliding in one file:

- New directory `src/features/import-review/lib/statement-layouts/` with one
  module per bank: `uob.ts` (extracted, behaviour-preserving), `dbs.ts`,
  `hsbc.ts`, `citibank.ts`, `paylah.ts`, plus a small `index.ts` registry and a
  shared `types.ts` for the layout interface.
- Layout interface (shape, not code): `detect(lines, pages)` returns the pages
  the layout claims; `groupRows(lines, claimedPages)` returns raw row groups
  with their continuation lines; `columns` metadata says whether amounts are the
  billed SGD amount and which marker (CR/DR or sign) denotes credits. The shared
  `qualifyRow`, period/year-rollover logic, classification and dedupe in
  `statement-parser.ts` stay the single source of truth.
- `parseStatementLines` selects the bank's layout; a page no layout claims for
  that bank still goes through today's conservative generic path, and a statement
  where nothing yields rows still throws "No supported transaction rows were
  found". Qualified layouts only add recognition; they never relax validation
  (no exchange rate assumed, no truncated decimals, valid positive SGD billed
  amount required).
- The extraction step in `src/features/import-review/lib/local-pdf.ts` is not
  expected to change unless a redacted sample shows a text-ordering problem;
  record that as a finding in the slice rather than altering it silently.

### Per-bank layout details

Source: the owner's real statements, redacted and summarised as layout notes
only. No names, card numbers, mobile numbers or balances appear here or may
appear in fixtures. The x values are pdf.js `transform[4]` positions, so treat
them as approximate column bands; amounts are right-aligned. Lines are grouped
as `positionedStatementLines` does today.

#### DBS credit card (4 pages, two cards per statement)

- Transaction header: `DATE DESCRIPTION AMOUNT (S$)`, columns at x~57/124/502.
  This does not match the current `billedSgd` regex (the likely cause of the
  reported failure), so the DBS layout detects this header itself.
- Each card section starts with `DBS <CARD NAME> CARD NO.: <number>`, then
  `PREVIOUS BALANCE n`, then `NEW TRANSACTIONS <cardholder name>`. These are
  section lines and yield no rows.
- Row: `DD MON description amount [CR]`. Date at x~54, description at x~95,
  amount at x~525-531, optional `CR` at x~550. `CR` means a credit.
- Payment rows have a continuation line `REF NO: <digits>`, kept as provenance.
- Footers to skip: `SUB-TOTAL:`, `TOTAL:`, `GRAND TOTAL FOR ALL CARD ACCOUNTS:`.
- Noise that must yield no rows: the page-1 summary line after the header
  `STATEMENT DATE CREDIT LIMIT MINIMUM PAYMENT PAYMENT DUE DATE` (it starts with
  a date), a payment-slip line of single digits, and
  `STATEMENT PRINTED ON DD Mon YYYY`.
- The row has no year; it comes from the supplied statement period.

#### Citibank credit card (3 pages, two cards)

- Header: `DATE DESCRIPTION AMOUNT (SGD)`, columns at x~51/106/503.
- Each section starts with `TRANSACTIONS FOR <CARD NAME>`, then
  `BALANCE PREVIOUS STATEMENT n`. A per-card line
  `<CARD NAME> <card number> - <name>` yields no rows.
- Row: `DD MON description [city] <2-letter country> amount`, amount at
  x~533-551.
- Credits are in parentheses, `(99.99)`, with no CR marker.
- Some rows end with an extra `SGD 99.99 9.99` group. FX rows are followed by
  `FOREIGN AMOUNT <CURRENCY NAME> 99.99`; that line is a continuation, not a
  row, and the foreign amount is never used as the SGD amount. Some rows carry a
  trailing 16-digit reference at x~584. An orphan masked-card line
  (`xxxx-xxxx-xxxx-9999`) yields no rows.
- Footers: `SUB-TOTAL:`, `GRAND TOTAL`. The page-1 summary and payment slip yield
  no rows.

#### DBS PayLah! (2 pages)

- Text contains both `PayLah!` and `DBS Bank Ltd`; see the identity
  discriminator above.
- Noise: the line after the header `STATEMENT DATE MOBILE NUMBER WALLET ACCOUNT`
  starts with `DD Mon YYYY` and is not a row.
- Transaction header: `DATE DESCRIPTION AMOUNT`, columns at x~54/112/509. The
  section is titled `PayLah! Wallet`, followed by `PREVIOUS BALANCE n CR`.
- Row: `DD Mon description amount CR|DB`, amount at x~493-508, marker at x~530.
  `DB` is spending (an expense). `CR` is a top-up or money received, a credit.
- Every row is followed by a `Ref No.: <code>` continuation line.
- End: `Total Balance Carried Forward: n CR`, skipped.
- Classification: a `CR` row follows the existing credit handling used for
  UOB/DBS card credits (no new classification value); `DB` rows are expense
  candidates.

#### HSBC

The owner's sample had zero text items: it is a scanned image PDF, so there is
no text layout to qualify. All HSBC details stay TBD and the HSBC slice is
blocked until a text e-statement arrives. Image PDFs keep failing with the
existing text-PDF-only error; HSBC gets no layout module until then.

### Fixtures and tests (same pattern as UOB)

- UOB's qualification today lives in `test/features/profile/statement-parser.test.ts`
  ("reconstructs split UOB headings and two-date rows from positioned PDF text"
  and "does not guess UOB billed amounts ..."), driven by synthetic positioned
  `StatementLine[]` helpers in that file, and the constructed-fixture JSON/PDFs
  under `docs/audit/pdf-import-fixtures/` (`statement-variants.json` plus the
  four `*-constructed-statement.pdf` files).
- For each new bank: add synthetic `StatementLine[]` fixtures (inline in a new
  `test/features/profile/statement-layouts-<bank>.test.ts`, or a shared synthetic
  fixture module under `test/`), hand-built to mirror the redacted layout, with
  the header text, column order and wrap behaviour of the real one but invented
  merchants, dates and amounts. Fixtures carry a `SYNTHETIC` marker line so the
  existing summary-skip rule and reviewers can see they are not real.
- Update `statement-variants.json` entries for DBS/HSBC/Citibank and add PayLah
  only if the owner agrees; its `supportedBankClaim` flag must become true for a
  bank only in the slice that ships that bank's layout tests.

### Contracts and migrations

- Merchant rules (spec 137): `bank` in the rule plaintext is
  `null | 'uob' | 'dbs' | 'hsbc' | 'citibank'`, validated by
  `z.enum(MERCHANT_BANKS)` in `src/features/merchant-rules/schemas.ts`, and the
  rulebook is a single AES-GCM ciphertext. No bank column exists in Postgres, so
  no SQL, RLS or migration is involved.
- Adding `'paylah'` must be mirrored in three enums that currently duplicate the
  list: `StatementBank` (types.ts), `MERCHANT_BANKS`
  (`src/features/merchant-rules/constants.ts`) and the `bank` enum in
  `src/features/expenses/lib/import-expense.ts` (line 38). Prefer deriving them
  from one constant rather than adding a fourth copy; this is within scope as
  part of the PayLah slice.
- Compatibility: the change widens a Zod enum. Existing stored rulebooks (banks
  limited to the four old values) keep validating. Forward-only caveat: once a
  PayLah-scoped rule is saved, a rollback to a build without `'paylah'` would
  fail strict validation of that rulebook envelope. The backout plan below covers
  this. Spec 137 describes the storage contract, so the implementation PR notes
  the enum widening there rather than changing the contract version
  (`schemaVersion: 1` stays, since old data is valid under the new schema).
- Expense notes use `value.bank.toUpperCase()` for the "Statement source:" text
  (import-expense.ts line 101). `PAYLAH` would be shown as-is; use the
  `STATEMENT_BANKS` label (`DBS PayLah`) for PayLah, and keep existing banks'
  note text identical so already-saved notes and duplicate matching are unaffected.
  Confirm duplicate detection does not key on this note text.
- Migration: none expected. Confirmed by reading: bank only appears inside
  encrypted payloads and in client-side state; the Supabase schema never sees it.

### Encryption-touching paths

None are added. PDF parsing runs entirely client-side; the only encrypted
payload affected is the merchant rulebook, via the enum widening above.

## Out of scope

- OCR or image-only statements; non-text PDFs keep failing visibly.
- Any new dependency (§3.1/§3.2); `pdfjs` extraction stays as is.
- Foreign-currency conversion or assumed exchange rates. Rows without a clear
  SGD billed amount stay unresolved.
- Banks beyond these four (OCBC, Standard Chartered, etc.).
- Changes to the review UI, save flow, merchant-rule matching or duplicate logic,
  other than adding the PayLah option and its label.
- Auto-detecting the bank from the PDF; the owner still picks the source.
- Committing, attaching or quoting any real statement.
- Changing UOB behaviour beyond a behaviour-preserving extraction.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` green (`/next-verify`)
- [ ] UOB: all existing UOB tests pass unmodified after the layout extraction
      (regression guard for the refactor slice)
- [ ] DBS: synthetic fixture mirroring the redacted DBS layout imports every
      transaction row with correct date (including year rollover from the
      supplied period), description (including wrapped lines), billed SGD
      amount, and classification; summary, balance and repayment lines are
      excluded; a fixture-level regression test reproduces today's failure on
      `main` and passes on the PR
- [ ] Citibank: same criteria, with its own synthetic fixture
- [ ] HSBC: blocked until a text e-statement is available; until then an
      image-only HSBC PDF still throws the text-PDF-only error (tested)
- [ ] DBS PayLah: selectable as `DBS PayLah`; same criteria; a PayLah text
      selected as DBS (and DBS text selected as PayLah) throws the identity error
- [ ] For every bank: foreign-currency lines never produce an assumed SGD amount;
      extra decimals, unsupported CR/DR suffixes and unsafe amounts do not
      become suggestions (existing guarantees kept)
- [ ] For every bank: an unknown or altered layout (header text missing or
      renamed, columns reordered, image-only text, empty input) still throws
      "No supported transaction rows were found" or the identity error, or
      yields unresolved rows, and never silently yields `candidate` rows
- [ ] Fixtures are synthetic, contain no real merchant names, card or account
      numbers, and carry a `SYNTHETIC` marker; no real statement is present
      anywhere in the diff
- [ ] Merchant rules: a `bank: 'paylah'` rule validates, matches only PayLah
      parses, and a rulebook of old banks still validates; import-expense
      accepts `'paylah'` and still rejects unknown values
- [ ] No migration file added; `git diff --stat` shows no `supabase/` changes
- [ ] No `any`, `console.log`, `@ts-ignore` or `eslint-disable`
- [ ] Manual: owner imports one real statement per bank locally and confirms the
      row count and totals against the PDF (this is done by the owner, not by an
      agent, and nothing from the statement is recorded in the repo)
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: statement review only. A wrong layout could mis-read amounts
  or dates, but every row still goes through human review before saving, summary
  and impossible-date rows stay unresolved, and nothing is saved automatically.
  The enum widening touches merchant-rule and import-expense validation, which
  gate saved data.
- **Reversibility**: a git revert of the implementation commits. No migration, so
  nothing irreversible in the schema.
- **Backout plan**: revert the per-bank slice that misbehaves (each is
  independent after the extraction slice). If a PayLah-scoped merchant rule was
  already saved, delete or re-scope it in the merchant-rules manager before
  reverting the PayLah slice, otherwise the old build would reject the rulebook
  envelope on strict validation.

## Suggested implementation slices

1. Refactor: extract UOB into `statement-layouts/uob.ts` with the registry and
   layout interface. Behaviour-preserving; existing tests unchanged.
2. PayLah source plumbing: `'paylah'` in `StatementBank`, `STATEMENT_BANKS`,
   `MERCHANT_BANKS`, import-expense enum (single shared constant), identity
   discriminator for DBS vs PayLah, label in the notes text, tests. No layout yet
   (PayLah still fails visibly until slice 5).
3. DBS layout and fixtures (the owner's current failure; ship first).
4. Citibank layout and fixtures. HSBC is blocked until the owner supplies a
   text e-statement; no HSBC layout slice starts before then.
5. PayLah layout and fixtures.
6. Update `statement-variants.json` claims and the parser doc comment; mark spec
   shipped.

Slices 3 to 5 each depend only on slice 1 (and 2 for PayLah), so they can be
built in parallel in separate files without conflicts.

## Open questions

- [x] Q: Redacted samples. A: received for DBS, Citibank and PayLah (layout
      notes above). The HSBC sample was an image PDF. — Owner: Clarence
- [x] Q: PayLah marker. A: `PayLah!`, checked before DBS; the DBS identity
      rejects text containing it. — Owner: Clarence
- [x] Q: PayLah CR mapping. A: `CR` is a credit and follows the existing credit
      handling for UOB/DBS card credits; `DB` is an expense. — Owner: Clarence
- [x] Q: Cause of the DBS failure. A: the header `DATE DESCRIPTION AMOUNT (S$)`
      does not match the `billedSgd` regex; the slice 3 builder confirms this
      with a failing test before changing code. — Owner: slice 3 builder
- [ ] Q: Does DBS wording include POSB savings-account statements that should
      also parse (the identity regex already matches `POSB`)? — Owner: Clarence
      — A: TBD
- [ ] Q: Will the owner supply a text (not scanned) HSBC e-statement? HSBC
      layout details stay TBD until then. — Owner: Clarence — A: TBD
- [ ] Q: Fixture reuse for `docs/audit/pdf-import-fixtures/`. Recommendation:
      write fresh synthetic fixtures that match the layouts above and leave the
      older constructed PDFs alone. — Owner: Clarence — A: TBD
- [ ] Q: Unify the three duplicated bank lists into one shared constant in this
      spec, or edit them separately? — Owner: Clarence — A: TBD
- [ ] Q: Confirm the PayLah note shows the `STATEMENT_BANKS` label instead of
      `bank.toUpperCase()` (`PAYLAH`), and accept the enum-widening rollback
      risk (a saved PayLah-scoped merchant rule fails validation in a build
      without `'paylah'`; see Risk). — Owner: Clarence — A: TBD
