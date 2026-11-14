---
id: '188'
slug: statement-period-detection
area: feature
status: shipped
author: Claude Code
created: 2026-11-11
approved: 2026-11-11
shipped: 2026-11-14
impl_pr: none (direct to main, 403dfba, ad69b49, 8702bbc, 98b46d7, 54798ca)
supersedes:
constitution_satisfies:
  - '§2.1'
  - '§2.7'
  - '§3.1'
  - '§3.2'
  - '§3.4'
  - '§4.1'
  - '§4.2'
  - '§5.1'
constitution_overrides:
---

# Spec 188: Read the statement date and period reliably

## Problem

On 2026-11-11 the owner tested the deployed statement import with four real
statements: an HSBC scan (OCR), a DBS card statement, a Citibank card statement
and a DBS PayLah statement. Bank auto-detect (spec 186) was right 4 of 4, but
`detectStatementPeriod(lines)` returned `null` for all four. Each time the
dialog said "We could not read a clear statement date or period. Enter the
dates, then extract again." (`statement-review.tsx`, the `if (!period)` branch
of `extract()`), and the rows parsed correctly once a period was typed by hand.
The import is meant to need no typing; today it needs typing on every statement
tested. No statement text is quoted in this spec; layouts are described in
general terms only.

Specs 182 and 186 also left four smaller gaps (section "Known gaps") that sit in
the same files and are cheap to close in the same piece of work.

## Constitution check

- Satisfies: `§2.1` and `§5.1` (everything runs on lines already extracted in
  the browser; nothing new leaves the browser, no PIN or DEK handling changes,
  no server change, no save-payload change), `§2.7` (named exports only), `§3.1`
  and `§3.2` (no new dependency; no banned pattern), `§3.4` (kebab-case files),
  `§4.1` (all five gates), `§4.2` (new pure logic is covered by tests).
- Overrides: none. No `HARD` rule is touched.

## Current mechanism (verified against the code and tests)

`detectStatementPeriod` lives in
`src/features/import-review/lib/statement-period.ts`; its tests are
`test/features/profile/statement-period.test.ts` (and the HSBC layout test in
`test/features/profile/statement-layouts-hsbc.test.ts`). The failure is
structural, not one bad regex. Each claim below was checked against the code.

1. **Label must open the line and be one of five phrases (confirmed).** The
   matcher is anchored with `^` and accepts only `Statement Period`, `Statement
Date`, `Date of Statement`, `Statement Month`, `Statement For`
   (case-insensitive). A header such as "Date of issue", "Closing date", "Billing
   period" or a label that OCR prefixes with a stray glyph is invisible.
2. **Anything after the label on the same line is the value (confirmed).** The
   rest of the line is taken whole and must be exactly one date or range. A
   multi-column header row (label followed by other column labels, values on the
   next row) therefore yields a non-date value and sets `invalid`. The same-line
   value is never searched for a trailing date; that rescue exists only for the
   next-line path.
3. **One bad labelled line poisons the result (confirmed).** Any labelled line
   whose value does not parse sets `invalid = true`, and the final guard
   `if (invalid || ...) return null` discards every clean line found elsewhere.
   There is no distinction between "not a date" and "a date that conflicts with
   another date".
4. **Narrow date grammar (confirmed, with one correction).** `DATE_TEXT` and
   `isoDate` accept `YYYY-MM-DD`, `D[/.-]M[/.-]YYYY` (the claim said only
   `D/M/YYYY`; dots and dashes are also accepted) and `D Mon YYYY` with a 3 to 9
   letter month. Not accepted: `Mon D, YYYY`, `DD Mon YY` (the existing tests
   assert two-digit years are rejected on purpose), a glued `DDMonYYYY` such as
   OCR can emit, and month spellings that are neither the full name nor the
   three-letter form (for example `Sept`). The `Statement Month` branch accepts
   only `Mon YYYY`.
5. **Next-line value path is narrow (confirmed, and narrower than claimed).**
   When the label has no text after it, the next line on the same page is the
   value. The "date is the last token" rescue
   (`value.match(DATE_TEXT + '$')`) runs only for labels containing "date": a
   `Statement Period` or `Statement Month` label whose value line carries any
   extra token fails the strict regex. The value line is never searched for a
   date that is not at its end, and a value more than one line below the label is
   never read.
6. **Ordering (confirmed).** `extract()` calls `detectStatementPeriod(lines)` at
   `statement-review.tsx:385`, before `presentStatement` resolves the bank.
   `ExtractedStatement.period` is then frozen in the `extracted` ref, so
   `reparse()` after a bank change reuses it and can never improve it.
7. **Bounds.** `validStatementPeriod` (`statement-parser.ts:95-103`) accepts
   `from <= to` and a span of at most 400 days. Nothing in the code suggests it
   rejects a current statement, so it is unchanged (see open question Q5 for the
   one case worth confirming). Rows are dated against the period by
   `statementDate`, which tries the period's year(s) and keeps a date only when
   exactly one candidate falls inside the period.

What is not yet known: the exact failing header shape of each of the four banks.
The brittleness above explains why a layout-specific header can fail; it does
not say which of items 1 to 5 each real header trips. The first slice exists to
find out, and later slices are written only against what it records.

## Solution shape

### Slice 1: capture redacted header layouts (no source change)

- The orchestrator runs the admin OCR dump page (`/dashboard/admin/ocr-dump`,
  formatter `src/features/import-review/lib/ocr-dump-format.ts`, digits masked)
  on the four real statements, as was done for HSBC in spec 182. Only line
  shapes are recorded: which line carries the date/period label, how many
  columns share that line, where the value sits relative to the label (same line,
  next line, glued), the date format class, the page it is on, and whether the
  text layer or OCR produced it.
- The shapes are added to this spec as an appendix (labels generic, digits as
  `D`/`M`/`Y`; no merchant, account or amount text). Synthetic fixtures for the
  later slices are written from the appendix, never from the PDFs.
- Slice 1 also records whether the HSBC statement date label matches the
  assumption in the current layout and tests (gap 3c).
- Output is a spec edit, not code. Slice 2 does not start until the appendix
  exists and the owner has seen it.

### Slice 2: per-bank period reader plus resolve-bank-first flow

- `StatementLayout` (`statement-layouts/types.ts`) gains an optional
  `period?(lines: StatementLine[]): DetectedStatementPeriod | null`. A bank that
  needs it implements it in its own layout file against its captured header
  shape (for example reading a label and the value in a different column or row,
  using `StatementLine.words` x positions where OCR supplies them). Banks whose
  headers already work generically implement nothing.
- `DetectedStatementPeriod` and its `basis` union stay as they are; a layout
  reader returns the same shape so the dialog's basis hint is unchanged. If a
  layout reader needs a new basis value it is added there and listed in the PR.
- `detectStatementPeriod(lines, bank?)` order: the bank's `period(lines)` when
  the bank is known and the layout has one; otherwise, and when the layout reader
  returns `null`, the generic labelled-header detector. The generic detector is
  hardened:
  - a labelled line whose value is not a date no longer sets `invalid`; it is
    ignored. Evidence that parses but conflicts (two different dates, a range
    whose end disagrees with a statement date, month and date in different
    months) still returns `null`. This is the safety property: never guess, and
    never silently pick between two disagreeing dates.
  - a same-line value that is not a date, but ends with or contains exactly one
    date, is read from that date (with the existing last-token rule extended to
    the same-line and the period/month labels, and to a bounded search of the
    value line when exactly one date-shaped token is present).
  - the date grammar adds `Mon D, YYYY`, `DD Mon YY` only when a printed year in
    the same statement confirms the century, and a glued `DDMonYYYY` as OCR emits
    it. The exact additions are limited to the formats Slice 1 shows are needed,
    plus `Sept`; formats not seen in a captured header are not added
    speculatively.
- Flow in `statement-review.tsx`: `extract()` reads the PDF lines, then resolves
  the bank (`presentStatement`'s existing auto-detect or the user's choice), then
  reads the period for that bank. The manual-entry fallback and its message stay
  exactly as they are for the `null` case. When the user typed a period
  (`manualPeriod`), that period is used and detection is skipped, as today.
  `ExtractedStatement` records whether its period was typed
  (`period.source: 'manual' | 'detected'`) so `reparse()` can decide.
- `reparse(choice)` after a bank change re-reads the period for the new bank
  from the stored lines when the period was detected, with no second PDF read and
  no OCR; if the re-read returns `null` it surfaces the same manual-entry message
  and keeps the stored lines and PDF so the user can type a period and extract
  again without re-reading the file. A typed period is never replaced.
- No change to `validStatementPeriod`, the save hook, the payload, the schema or
  the server.

### Slice 3: known gaps (a and b)

- **a. HSBC table continuing on a later page without a repeated column header.**
  `scan()` in `statement-layouts/hsbc.ts` resets `inTable = false` whenever the
  page number changes and only a header line sets it back to `true`
  (`hsbc.ts:153-163`). Rows on a page whose table has no repeated header are
  dropped silently. Fix: on a page after the first claimed page, keep the
  previous page's table state until the page shows a `Total Due` line, but only
  when that page contains at least one line that `parseRow` accepts; a page with
  no row-shaped lines stays outside the table. `detect()` already claims every
  page when any header is present, so no change there. Tested with a synthetic
  two-page fixture whose second page has no header, plus one where the second
  page has non-table text only.
- **b. A description that begins with four digits read as a year.**
  `DATE_PREFIX` (`statement-layouts/patterns.ts:3-4`) ends the date with an
  optional `(?:[ /-](\d{4}))?` year group. A row such as `DD MM NNNN SHOP ...`,
  or `DD Mon NNNN SHOP ...`, matches the four-digit description start as the
  year; `statementDate` (`statement-parser.ts:116-118`) then tries only that
  year, no candidate falls inside the period, and the row's date comes back
  empty (unresolved). Fix: treat the captured four digits as a year only when
  they equal a year of the period (open question Q6); otherwise leave them in
  the description. This is applied
  where `statementDate` consumes the match, not by loosening the shared regex, so
  line grouping in `groupDateRows` is unchanged. Tested with synthetic rows with
  a four-digit description start, a real printed year, and a printed year that
  disagrees with the period.
- **c. HSBC statement-date label assumption.** Not a code slice. It is settled by
  Slice 1's capture; if the label differs from what the layout and tests assume,
  Slice 2 covers it.
- **e. Observation only.** On the HSBC statement one row's amount was unreadable
  (kept with an empty amount at 0% confidence, which is by design in `parseRow`),
  and the total check was off by a small amount consistent with that row being a
  credit. This is listed under risks; no fix is promised here.

### Slice 4: OCR call-count test (spec 186 gap d)

- Spec 186's test plan asked for a test proving a bank change after an OCR
  extraction does not run recognition again. It was not added because
  `test/features/profile/statement-review.test.tsx` mocks
  `openLocalStatementPdf` wholesale, so no recogniser is ever called. Proposed:
  a counted fake recogniser at the local-pdf seam. Mock only the OCR engine
  boundary that `openLocalStatementPdf` calls (the recognise function used by
  `statement-ocr.ts`), keep the real `openLocalStatementPdf` and
  `LocalStatementPdf.extract()`, feed it a small synthetic image-only PDF
  fixture, and assert: one extraction calls the fake recogniser once per
  image-only page; a bank change through the "Change statement bank" select
  leaves the count unchanged and re-renders rows from the stored lines; a second
  extraction (new file or Extract again) increases it. If a synthetic
  image-only PDF is not practical to build without a new dependency, fall back to
  spying on `LocalStatementPdf.extract` at the same seam and asserting it is
  called once across a bank change.

## Out of scope

- Changing `validStatementPeriod` bounds or the 400-day span.
- Guessing a period when evidence is absent, conflicting or implausible; manual
  entry stays the fallback and always wins.
- Any fix for observation e (unreadable amount, total check off by a small
  amount); investigation only if the owner asks.
- New banks, new dependencies, server changes, schema or payload changes.
- Re-running recognition on a bank change (spec 186 already avoids it; slice 4
  only adds the missing test).
- Lazy-loading or performance work on the import dialog.

## Acceptance

- [ ] Slice 1: appendix of redacted header shapes for the four banks exists in
      this spec, owner-reviewed, with no statement text in it.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` all green (`§4.1`).
- [ ] For each of the four banks, a synthetic header fixture built from the
      appendix yields the expected `period` and `basis` through the new flow.
- [ ] A fixture with one unparseable labelled line plus one clean labelled line
      yields the clean line's period; a fixture where two clean labelled dates
      disagree still yields `null`.
- [ ] The existing "requires fallback" cases in `statement-period.test.ts`
      (conflicting, absent, invalid, out-of-bounds, wrong-page, two-digit-year)
      still return `null`.
- [ ] A manually typed period overrides detection and is not replaced by a bank
      change.
- [ ] Changing the bank after extraction re-reads the detected period for the new
      bank without a second `extract()` or recogniser call (slice 4 test).
- [ ] A synthetic two-page HSBC fixture with no repeated column header on page 2
      keeps its page-2 rows (gap a).
- [ ] A synthetic row whose description starts with four digits keeps its date
      and the digits stay in the description (gap b).
- [ ] No new dependency (`package.json` and lockfile unchanged); no `any`, no
      `console.log`, no `@ts-ignore` (`§3.2`, `AGENTS.md §3`).
- [ ] Manual (owner, deployed site): all four real PDFs show the statement date
      or period read automatically with no typing, and the rows' dates fall
      inside it.
- [ ] Spec hash matches at impl PR time.

## Risk & reversibility

- **Blast radius**: the statement import dialog only. A wrong period would date
  rows wrongly, so the safety property is the main risk: ambiguity returns
  `null`, never a guess, and the review step still shows the period for the user
  to correct before saving. Hardening the generic detector (ignoring unparseable
  labelled lines instead of failing) widens what it accepts; the conflict tests
  above are the guard.
- **Reversibility**: pure client logic and component state; a single git revert
  per slice. No data, migration or encryption path changes. Saved statements do
  not store the detector's output beyond the existing source text.
- **Backout plan**: revert the slice-2 commit to restore manual-entry fallback
  behaviour; slices 3 and 4 are independent and can stay or go separately.
- **observation e**: an unreadable-amount row (probably a credit) makes the
  statement total check disagree by a small amount. That is flagged by design,
  but a user could read a "total off" message as a period or parsing failure.

## Open questions

- [x] Q1: What are the failing header shapes on the four banks? — Owner:
      orchestrator (slice 1). — Proposed default: none; blocks slice 2. Appendix
      added before approval of slice 2's details.
      Answer: see Appendix A (captured 2026-11-12).
- [x] Q2: Per-bank `period()` on `StatementLayout`, or one generic detector with
      more phrases? — Owner: Clarence. — Proposed default: per-bank optional
      reader with the hardened generic detector as fallback, because each bank
      prints its header differently and a shared grammar keeps growing.
      Answer (Clarence, 2026-11-11): proposed default accepted.
- [x] Q3: Should `DD Mon YY` be accepted? — Owner: Clarence. — Proposed default:
      only when the same statement prints a four-digit year that fixes the
      century; otherwise rejected (existing tests keep two-digit-year bare
      headers failing).
      Answer (Clarence, 2026-11-11): proposed default accepted.
- [x] Q4: Should a failed re-read after a bank change clear the rows and ask for a
      typed period, or keep the old period? — Owner: Clarence. — Proposed default:
      show the manual-entry message and clear rows, because the old period was
      read for a different bank's header and may be wrong.
      Answer (Clarence, 2026-11-11): proposed default accepted.
- [x] Q5: Do any current statements print a period longer than 400 days, or a
      statement date outside the preceding-month window the `statement-date` and
      `statement-month` bases assume? — Owner: Clarence. — Proposed default: no;
      keep the bounds and raise a follow-up spec if a real statement needs more.
      Answer (Clarence, 2026-11-11): proposed default accepted.
- [x] Q6: For gap b, accept a four-digit year only when it equals a year of the
      period or one either side, or only an exact period year? — Owner: Clarence.
      — Proposed default: exact period years plus none other, since
      `statementDate` already only keeps dates inside the period.
      Answer (Clarence, 2026-11-11): proposed default accepted.
- [x] Q7: observation e, the unreadable HSBC amount that is probably a credit:
      investigate now or leave? — Owner: Clarence. — Proposed default: leave,
      document in the PR, and open a separate spec only if it recurs.
      Answer (Clarence, 2026-11-11): proposed default accepted.
- [x] Q8: Slice 4: mock the OCR engine boundary with a synthetic image-only PDF,
      or spy on `extract` only? — Owner: Clarence. — Proposed default: counted
      fake recogniser first, `extract` spy as the fallback if no synthetic
      image-only PDF can be built without a dependency.
      Answer (Clarence, 2026-11-11): proposed default accepted.

## Appendix A: redacted header shapes (captured 2026-11-12)

Method: admin OCR dump page on the deployed site, digit masking on, four real
October 2026 statements, nothing saved. The dump page always runs OCR and never
shows the pdfjs text layer, so for the three text-layer banks (DBS, Citibank,
PayLah) the x/y values are OCR approximations; the text-layer line grouping for
DBS and PayLah was confirmed separately from the 2026-11-08 layout notes. All
shapes are on page 1 unless stated. Digits stay as D/M/Y placeholders.
Coordinates are PDF points, y measured from the page bottom, page 595x842.

### DBS card (text layer in the app)

- The label line (y~618) carries four column labels on one line:
  `STATEMENT DATE` x~83, `CREDIT LIMIT` x~220, `MINIMUM PAYMENT` x~336,
  `PAYMENT DUE DATE` x~462.
- The values are on the next line (y~603): `DD Mon YYYY` x~95, `$D,DDD.DD` x~228,
  `$DD.DD` x~362, `DD Mon YYYY` x~479. The first date is the statement date, the
  last is the payment due date.
- No statement period is printed.
- Page 3 footer: `STATEMENT PRINTED ON DD Mon YYYY` x~384, value on the same
  line. It is a print date, not the statement-date label.
- `Statement of Account` heads every page and is not a label.

### Citibank (text layer in the app)

- Right-hand summary block under `YOUR BILL SUMMARY` (x~309).
- `Statement Date` x~310 with the value on the same line at x~447, format
  `Month DD, YYYY` (full month name, comma). A stray glyph follows at x~579.
- A later line: `Payment Due Date` x~310, value `Month DD, YYYY` x~447.
- No statement period is printed.
- Top line `Statement of Account ... Page D of D`.
- Unverified: whether the text layer merges left-column text in front of the
  `Statement Date` label (in OCR the line started at the label).

### DBS PayLah (text layer in the app)

- The label line (y~666) carries three column labels on one line:
  `STATEMENT DATE` x~96, `MOBILE NUMBER` x~266, `WALLET ACCOUNT` x~430.
- OCR missed the value line completely. From the text layer (2026-11-08 notes)
  the next line starts `DD Mon YYYY`, followed by the mobile number and wallet
  number.
- No statement period is printed.

### HSBC (image-only PDF, OCR in the app)

- The label line (y~654) carries four column labels on one line:
  `Statement period` x~59, `Total Due` x~239, `Minimum Payment` x~328,
  `Payment Due Date` x~427.
- The values are on the next line (y~638): `From` x~59, `DD` x~86, `MON` x~101,
  `YYYY` x~125, `to` x~151, `DD` x~163, `MON` x~178, `YYYY` x~203 (month in
  uppercase, each part a separate OCR token), then the total due amount x~240,
  the minimum payment x~328, then `DD Mon YYYY` x~427.
- Gap 3c answer: the trailing `DD Mon YYYY` is the payment due date, not a
  statement date. HSBC prints an explicit period (`From ... to ...`) and no
  "Statement date" label.

### Why the current detector fails on all four

- DBS, PayLah, HSBC: the label is followed on the same line by other column
  labels, which the detector takes as the value and marks invalid; the real
  value is on the next line, positioned under its label.
- Citibank: the value is on the same line but in `Month DD, YYYY`, a format the
  detector does not accept.

### Implications for slice 2

These are observations, not new requirements.

- A multi-column label line needs the value read from the next line by column
  position (first date for DBS and PayLah; the `From ... to ...` range for
  HSBC), and a payment due date sharing that line must never be taken as the
  statement date.
- `Month DD, YYYY` needs to be a recognised date format.
