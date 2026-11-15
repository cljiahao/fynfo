---
id: '189'
slug: statement-import-followups
area: feature
status: draft
author: Claude Code
created: 2026-11-15
approved:
shipped:
impl_pr:
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

# Spec 189: Statement import follow-ups (Citi billed amount, HSBC junk token, savings statements)

## Problem

Owner testing of the deployed statement import (main at `b2ba380`, evidence
date 2026-11-15) left three leftovers from specs 181, 182, 186 and 188. No
statement text is quoted in this spec; every shape below is redacted (digits as
`9`, merchant letters as `a`, `x` is the left edge of the OCR or text token).

- **A. Citi rows land in Needs review.** On a real Citi card statement of 27
  rows, exactly 5 rows have an SGD-tagged amount in the middle of the line
  followed by the billed amount in the amount column. The suggested amount for
  those rows is the mid-line figure, and the dialog flags the amount columns as
  ambiguous. The 5 "Needs review" rows were matched to these 5 rows by count
  only; that is the evidence level, not a row-by-row comparison.
- **B. An HSBC row is kept at 0% confidence with an empty amount.** On a real
  HSBC scan the amount of one row was read correctly but the row still came out
  with no amount, and the statement total check (exact cents, no tolerance) was
  off by 1.00.
- **C. DBS or POSB savings statements are misparsed, not rejected.** Reasoned
  from the code, not run: with bank "DBS" chosen manually, a deposit-account
  statement is parsed by the generic date-row fallback, so a deposit line could
  be offered as an expense suggestion.

Two further observations are recorded as closed or still open at the end of
this section so they are not re-investigated.

- **Closed without change: Citi amount without a decimal point.** The admin OCR
  dump page always runs OCR (`components/ocr-dump.tsx`), while the review dialog
  reads the pdf.js text layer unless a page needs OCR
  (`lib/local-pdf.ts:145-173`). No code inserts or removes a decimal point:
  `MONEY` (`statement-layouts/patterns.ts:5-6`) requires a literal dot. The dump
  showed OCR dropping the dot; the value in the dialog came from the text layer.
  No code change.
- **Still open, not addressed here:** a real end-to-end SAVE of an imported
  statement has never been done. That is an owner test on the deployed site, not
  a code change, and it is not a precondition of this spec.

## Constitution check

- Satisfies: `§2.1` and `§5.1` (all logic runs on lines already extracted in the
  browser; nothing new leaves the browser, no PIN or DEK handling changes, no
  server change, no save-payload change), `§2.7` (named exports only), `§3.1`
  and `§3.2` (no new dependency, no banned pattern), `§3.4` (no new file names
  outside kebab-case), `§4.1` (all five gates), `§4.2` (each behaviour change is
  proved by a test on synthetic fixtures).
- Overrides: none. No `HARD` rule is touched. No `SOFT` override is needed.
- No new `'use client'`, no migration, no crypto change, no new dependency
  (`AGENTS.md §0.4` is not triggered).

## Current behaviour (verified against the code)

Each claim was read from the code on `b2ba380`. Where a pointer in the request
that led to this spec was wrong, it is corrected here.

### Item A: Citi

- `cleaned()` (`statement-layouts/citi.ts:26-32`) trims the line, drops a
  trailing 16-digit reference (`TRAILING_REFERENCE`, `citi.ts:20`) and drops an
  SGD trailer with `SGD_TRAILER` (`citi.ts:23-24`). `SGD_TRAILER` requires
  `SGD`, two amounts, and a lookahead for a third amount at the end of the line.
  It therefore matches `SGD 9.99 9.99 9.99` (strips the first two) and does not
  match `SGD 99.99 9.99` (only two amounts).
- `groupRows` (`citi.ts:59-72`) emits one single-line group per `ROW_START` line
  and skips `FOREIGN AMOUNT` continuation lines (`citi.ts:68`).
- `qualifyRow` (`statement-parser.ts:269-357`) collects every `MONEY` match in
  the body. With exactly one `SGD`-tagged match it chooses that match
  (`statement-parser.ts:282-290`), and with a second non-USD value it adds
  "Multiple amount columns are ambiguous; compare the original statement."
  (`statement-parser.ts:336-342`). The suggested amount is therefore the
  mid-line SGD figure and the row is flagged.
- Layout flags are `columns: { billedSgd: true, twoDate: false }` (`citi.ts:73`).

Redacted shape of the 5 rows (x of each token from the OCR dump; the review
dialog reads the text layer, which has no x, so the rule must work on text):

```text
99 SEP aaaaaaaaaaaaaaaa   208|SGD 247|99.99   551|9.99
```

Date, a one-word description, an `SGD` token at x~208, an amount at x~247, then
the billed amount at x~551. Every Citi row's billed amount is the last token on
the line (x~533-551).

### Item B: HSBC

Redacted OCR shape of the row:

```text
99 Sep 99 Sep aaa aaa aaa. aaa. aa aa   349|9.99   383|-—
```

The amount is read correctly at x~349 and a punctuation token sits at x~383.

- `TABLE_MAX_X = 385` (`hsbc.ts:13`) and `AMOUNT_MIN_X = 300` (`hsbc.ts:16`), so
  x 383 is inside the table and inside the amount column.
- `trailingAmount` (`hsbc.ts:89-104`) tests only the last token against
  `AMOUNT_WITH_CREDIT` (`hsbc.ts:26`), or a last token of `CR` plus the token
  before it. A last token that is neither returns `undefined`, and `parseRow`
  then sets confidence 0 and no amount (`hsbc.ts:125-127`).
- Total check: `reconcileStatement` (`statement-guards.ts:54-80`) compares exact
  cents with no tolerance, and it counts the empty-amount row as 0.

**Correction to the request.** `tableTokens` already drops every token that has
no ASCII letter or digit (`hsbc.ts:59`, unchanged since `b2881dc`, spec 182),
before `trailingAmount` runs. A pure-punctuation token such as `-—` or `_—` is
therefore never the last token. The existing fixture at
`test/features/profile/statement-layouts-hsbc.test.ts:231-248` already puts a
`_—` token at x=383 after a valid amount and expects the amount to be kept. So
the mechanism in the request (a punctuation-only token surviving into
`trailingAmount`) does not match the code. Either the real token contains at
least one ASCII letter or digit that the redaction rendered as punctuation (for
example a misread glyph such as `-I`, `_l`, `—1`), or the amount token itself
carried an attached character that failed `AMOUNT_WITH_CREDIT`. This spec does
not assume which; the first step below settles it.

### Item C: DBS and POSB savings statements

- Auto-detect returns none: `dbsLayout.detect` (`statement-layouts/dbs.ts:16-19`)
  claims pages only when a `DATE DESCRIPTION AMOUNT (S$)` header exists
  (`dbs.ts:5`).
- Bank identity for `dbs` is `/\bDBS\b|\bPOSB\b/i` with an exclusion for PayLah
  wallet text (`constants.ts:11-18`), so a savings statement passes the manual
  bank gate in `matchesStatementIdentity` (`statement-parser.ts:361-370`).
- `parseStatementLines` (`statement-parser.ts:375-420`) builds groups from
  `layout.groupRows(...)` plus `groupDateRows(unclaimed)`; with no claimed page
  every line is unclaimed, so `groupDateRows` (`patterns.ts:17-39`) turns each
  date-led line into a row, and continuation lines are attached while a row has
  no `MONEY` match yet. A savings line such as a dated deposit becomes a
  candidate and can be suggested as an expense when it carries a positive amount
  and no credit wording. This is reasoned from the code and has not been run;
  acceptance requires a synthetic fixture proving it before the fix.
- The same fallback applies to every bank whose layout claims no page:
  `uob` and `paylah` when their own markers are missing, and `hsbc` and
  `citibank` when their column headers are missing (those layouts claim pages
  only on a header). This is a risk noted below, not scope here.

## Solution shape

All edits are client-side, pure line logic. The only files a later
implementation may touch are listed per item and in "Files". Nothing in
`src/app`, `src/proxy.ts`, server actions, API routes, `src/lib/**` crypto files
or Supabase is touched.

### Item A: Citi billed amount is the trailing amount

Rule. On a Citi row, the billed amount is the last amount token on the line. A
mid-line `SGD <amount>` that is followed by exactly one further amount at the
end of the line is description detail and is not a competing amount: it is
dropped in `cleaned()` the same way `SGD_TRAILER` already is. Implementation
shape: a second trailer pattern in `citi.ts`, applied after `SGD_TRAILER`,
matching `\s+SGD\s+<amount>(?=\s+\(?<amount>\)?\s*$)` where `<amount>` is
`[\d,]+\.\d{2}`. It works on `line.text`, so it behaves the same for text-layer
rows (no x) and OCR rows.

Edge cases the tests must pin:

- Credit in parentheses in the amount column: `SGD 99.99 (9.99)`. The trailing
  `(9.99)` stays; the mid-line figure is dropped; the existing credit handling
  in `suggestClassification` (`statement-parser.ts:167-168`, parentheses) still
  classifies the row as a credit and blocks it from becoming an expense.
- A row followed by a `FOREIGN AMOUNT` continuation line: that line is still
  skipped (`citi.ts:68`) and does not change the row's amounts.
- Text-layer row without x: same result as the OCR row.
- Trailing 16-digit reference after the billed amount: `TRAILING_REFERENCE` runs
  first (`citi.ts:29`), so the new pattern sees the amount last.
- `SGD <amount>` as the last amount with nothing after it (one amount only): not
  matched; unchanged.

Must NOT change:

- The existing `SGD_TRAILER` case (`SGD a b` followed by a third amount) keeps
  its current output.
- A row with a single amount keeps its current output, including a row whose
  single amount is `SGD`-tagged.
- A row that carries `USD` or another non-SGD tag keeps the current handling in
  `qualifyRow` (`statement-parser.ts:281-290, 338`).
- `qualifyRow`, `groupDateRows` and the generic ambiguity message are not
  edited; other banks are unaffected.

Out of scope for Item A: deciding what these 5 rows are; changing how the
amount is chosen for any other bank; reading the amount column by x position.

### Item B: HSBC junk token after the amount

Step 0 (evidence, no source change, owner action, blocks the rule). The owner
re-runs the admin OCR dump on that HSBC statement and records only the character
classes of the token at x~383 (for example "one dash, one em dash, one lowercase
letter"), whether it carries any ASCII letter or digit, and whether the amount
token at x~349 is a clean `9.99` or has an attached character. This goes into an
appendix of this spec as redacted shapes. The rule below is written for the
likely case and is adjusted at approval if the appendix shows another cause.

Alternatives considered:

1. **Ignore trailing tokens with no letter or digit** (the request's proposal).
   Already in force at `hsbc.ts:59`; it cannot be the missing piece. Rejected as
   a change, kept as a regression test.
2. **Skip any trailing token to the right of the amount band edge.** Rejected:
   letter-bearing text right of an amount is evidence of a misread amount or a
   different line, and silently dropping it widens what is accepted.
3. **Skip one trailing junk token only when it is short (at most 2 characters),
   not `CR`, sits at x >= 370 (the divider band at the table edge), and follows
   a valid amount token; keep the amount but cap the row's confidence below
   `OCR_CONFIDENCE_THRESHOLD` (80) so it is flagged.** Chosen. It recovers the
   amount for the owner to confirm and never lets the row pass as clean.
4. **Leave as is.** The row stays flagged and the total check stays red; the
   owner types the amount. Safe but the import stays noisy; kept as the fallback
   if Step 0 shows the cause is something this rule cannot express.

Chosen rule (alternative 3), in `trailingAmount` / `parseRow` (`hsbc.ts:89-146`):

- When the last token is not an amount and not `CR`, but the token before it is
  a valid in-column amount (`AMOUNT_WORD` or `AMOUNT_WITH_CREDIT`), and the last
  token is at most 2 characters, is not `CR` (case-insensitive) and has
  `x >= 370`, the amount is taken from the earlier token, the junk token is
  dropped from the row text, and the row confidence becomes
  `min(real minimum confidence, 79)` (below `OCR_CONFIDENCE_THRESHOLD = 80`), so
  `isLowConfidenceRow` (`statement-guards.ts:6-12`) flags it. Without x (text
  layer) the rule does not apply; HSBC rows are OCR only.
- A longer or otherwise letter-bearing trailing token still fails closed exactly
  as today (no amount, confidence 0).
- Separate-token `CR`, attached `CR` and pure-punctuation tokens keep today's
  behaviour; this rule only adds a branch for the short-junk case.
- Why the cap and not the real confidence. The request asked that the row keep
  its real OCR confidence. That is right for a pure-punctuation token (already
  the case, and tested). For a letter-bearing junk token the parser cannot tell
  junk from a misread `CR`, and a silently accepted debit would add to expenses
  what may be a credit. Keeping the real confidence would let a high-confidence
  line pass unflagged, so the spec proposes the conservative cap. This is the
  second open question for the owner.

Edge cases the tests must pin:

- Pure-punctuation trailing token (`-—`, `_—`) at x 383: amount kept, real
  confidence kept (regression for the existing behaviour).
- Short letter-bearing junk token (for example `Cl`, `l`, `1`... any 1-2
  characters that are not `CR`) at x 383 after a valid amount: amount kept,
  confidence capped at 79, row flagged, the junk absent from the row text.
- Long letter-bearing token (3 or more characters) at x 383: no amount,
  confidence 0 (unchanged fail-closed).
- Short junk token at x < 370: no amount, confidence 0 (unchanged).
- `CR` as separate token and attached (`1,000.00CR`): credit, unchanged.
- Junk token plus `CR` after it (`9.99 x CR`): not covered; stays fail-closed.
- Total check: with the synthetic fixture, the recovered amount makes
  `reconcileStatement` return `matched` where it returned `mismatch` before.

Explicitly out of scope for Item B: a second HSBC row whose amount token itself
was OCR'd as letters (dates glued like `99Sep`, line confidence 1) is not
recoverable by parsing and stays flagged. Observation e in spec 188
(`specs/feature/188-statement-period-detection.md`, section "Slice 3",
lines 199-202, and "Out of scope", lines 227-228) is the origin of this item;
that spec deferred it and this spec picks it up for the junk-token case only.

### Item C: reject deposit-account statements

Rule. When the bank is `dbs` (the identity that also matches POSB), the layout
claims no page, and the text carries a deposit-account column header (a line
containing the words `WITHDRAWAL` and `DEPOSIT` and `BALANCE` as column labels,
in any order on one line, case-insensitive, for example the shape
`aaaaaaaaaa  aaaaaaa  aaaaaaa  aaaaaaa`), `parseStatementLines` throws:
"Savings account statements are not supported yet. Import a card statement."
Surfacing the message needs a small UI edit. The `catch` in `reparse()`
(`components/statement-review.tsx:316-327`) discards the thrown error and always
shows "The selected bank could not be identified in this PDF...", so a thrown
savings message would never reach the owner. Proposed: export a named error
class (for example `UnsupportedStatementError`) from `statement-parser.ts`,
throw it for this case, and in the `catch` show its message when
`error instanceof UnsupportedStatementError`, keeping the current text for every
other error. The component already is a client component; no new `'use client'`.

Shape (redacted, synthetic form used in tests):

```text
DATE   DESCRIPTION   WITHDRAWAL   DEPOSIT   BALANCE
99 Sep aaaaaaaaaaaaa   9.99   9,999.99
```

Implementation shape: one exported pattern and a small predicate in
`statement-layouts/patterns.ts` (for example `isDepositAccountHeader(text)`),
and one guard in `parseStatementLines` (`statement-parser.ts`) placed after the
identity check and before grouping, active only when `bank === 'dbs'` and
`claimedPages.size === 0`. A card statement that happens to mention the word
"balance" or "deposit" is not affected because the guard needs all three column
words on a single line and no claimed page.

Edge cases the tests must pin:

- Savings header present, bank `dbs`: throws the message above (today the same
  fixture yields candidate rows; the test first asserts that, then the fix flips
  it, which records the current misparse).
- A real card fixture (header `DATE DESCRIPTION AMOUNT (S$)`) with a
  description containing `DEPOSIT`: parses as before.
- The PayLah fixture and the UOB fixture: unchanged.
- A DBS text with no header of either kind: unchanged (still falls back, still
  returns rows or the existing "No supported transaction rows" error).
- In the dialog, a savings fixture with bank DBS shows the savings message and
  no rows; any other parse error still shows the existing bank message.
- Auto-detect (`statement-bank-detect.ts`) is unchanged; the guard acts only on
  the manual or confirmed `dbs` parse.

Risk noted, not widened: the generic fallback also exposes `uob` and `paylah`
(when their markers are missing) and `hsbc` and `citibank` (when their column
header is missing) to misparsing unrelated statement types. This spec does not
guard them; a later spec may generalise the check once a real sample of another
bank's deposit statement exists.

Out of scope for Item C: parsing savings statements; any real savings sample;
changes to bank identity patterns or auto-detect; guarding other banks.

## Files a later implementation may touch

- `src/features/import-review/lib/statement-layouts/citi.ts` (Item A)
- `src/features/import-review/lib/statement-layouts/hsbc.ts` (Item B)
- `src/features/import-review/lib/statement-layouts/patterns.ts` (Item C
  predicate)
- `src/features/import-review/lib/statement-parser.ts` (Item C guard and error
  class only)
- `src/features/import-review/components/statement-review.tsx` (Item C: show
  the error message in the `catch` of `reparse()`)
- `test/features/profile/statement-review.test.tsx` (Item C: the message reaches
  the dialog)
- `test/features/profile/statement-layouts-citi.test.ts` (Item A tests)
- `test/features/profile/statement-layouts-hsbc.test.ts` (Item B tests)
- `test/features/profile/statement-parser.test.ts` (Item C tests)
- This spec file (appendix of redacted shapes, then status and ship fields)

Nothing else. `test/features/profile/statement-layouts-dbs.test.ts`,
`test/features/import-review/statement-guards.test.ts` and
`test/features/import-review/statement-bank-detect.test.ts` are run unchanged as
regression and must still pass.

## Out of scope

- Supporting savings or deposit-account statements.
- Any change to bank auto-detect, `validStatementPeriod`, period readers or the
  total-check tolerance.
- Deciding what the 5 Citi rows are or changing how any other bank picks its
  amount.
- The HSBC row whose amount token itself was OCR'd as letters.
- A decimal-point fix for Citi (closed without change, see Problem).
- The end-to-end SAVE of an imported statement (owner test).
- New banks, new dependencies, server changes, schema, payload or crypto changes.
- Real statement content in the repo: fixtures are synthetic and built from the
  redacted shapes in this spec, never from the PDFs.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`,
      `pnpm build` all green (`§4.1`).
- [ ] Item A: a synthetic Citi row with the shape
      `99 SEP aaaa SGD 99.99 9.99` yields the trailing amount `9.99` with no
      "Multiple amount columns are ambiguous" issue and status `candidate`; the
      same row with `(9.99)` stays a credit and is not an expense candidate; a
      row followed by a `FOREIGN AMOUNT` line and a row with a trailing 16-digit
      reference give the same amount; a text-layer (no x) variant gives the same
      result.
- [ ] Item A, unchanged cases: the existing `SGD a b c` fixture and single-amount
      rows produce the same output as before (existing assertions untouched).
- [ ] Item B: Step 0 appendix recorded and owner-reviewed before implementation.
- [ ] Item B: tests for the pure-punctuation, short letter-bearing, long
      letter-bearing, left-of-370 and `CR` cases listed above, plus the total
      check going from `mismatch` to `matched` on the recovered row.
- [ ] Item C: a synthetic savings-layout fixture first asserted to produce
      candidate rows under the old code path (recorded in the PR body), then
      asserted to throw the savings message; card, PayLah and UOB fixtures
      unchanged.
- [ ] No new dependency (`package.json` and lockfile unchanged); no `any`, no
      `console.log`, no `@ts-ignore` (`§3.2`, `AGENTS.md §3`).
- [ ] Only the files in "Files a later implementation may touch" changed.
- [ ] Manual (owner, deployed site): the Citi statement shows the 5 rows with
      the billed amount; the HSBC row shows the amount flagged for review; a
      savings PDF with bank DBS chosen shows the "not supported yet" message.
- [ ] Spec hash matches at impl PR time.

## Risk & reversibility

- **Blast radius**: the statement import dialog only, three layouts. Item A
  changes which amount a Citi row suggests; a wrong rule could suggest the wrong
  figure for a row type not yet seen, so the pattern is anchored to the line end
  and to exactly one further amount. Item B accepts a row it previously
  rejected, bounded by the length, position and confidence cap above; the risk
  is a misread `CR` taken as a debit, mitigated by the forced review flag. Item C
  can only add a rejection, and only for a `dbs` parse with no claimed page and a
  three-word column header.
- **Reversibility**: pure client logic; a single git revert per item. No data,
  migration or encryption path changes. Nothing is saved by this change.
- **Backout plan**: revert the item's commit; items are independent.
- **Residual**: the generic fallback exposure of other banks (Item C risk note)
  and unrecoverable letter-misread HSBC amounts remain.

## Open questions

- [ ] Q1: What are the 5 Citi rows (fee, conversion or foreign-spend rows?) and
      is the trailing figure the right expense amount? — Owner: Clarence. — A:
      The 5 rows were matched to the 5 "Needs review" rows by count only.
      Compare them against the paper statement before approving Item A; if the
      mid-line SGD figure is the right amount for any of them, the rule changes.
- [ ] Q2: Is the HSBC row with the junk token at x~383 a credit on the paper
      statement (the junk token may be a misread `CR`)? — Owner: Clarence. — A:
      The parser cannot know. Proposed default: keep the amount but force the row
      below the confidence threshold so it is flagged for review and never
      silently accepted as a debit (alternative 3). If it is a credit, the
      proposal still flags it and the owner marks it; if it is a debit, the flag
      costs one confirmation.
- [ ] Q3: Run Step 0 (re-run the OCR dump on that HSBC statement and record the
      character classes of the token at x~383 and of the amount token)? — Owner:
      Clarence. — A: required, because the code already drops pure-punctuation
      tokens, so the real cause is unproven. If the appendix shows another cause,
      Item B is rewritten before approval.
- [ ] Q4: For Item C, is a single-line `WITHDRAWAL` + `DEPOSIT` + `BALANCE`
      header the right deposit-account signal, given no real savings statement
      has been examined? — Owner: Clarence. — Proposed default: yes; if a real
      savings PDF prints these labels on separate lines, the owner supplies a
      redacted shape and the predicate is adjusted.
- [ ] Q5: Is the 2-character, x >= 370 bound for the HSBC junk token acceptable,
      or should Item B stay at "leave as is" (alternative 4) until Step 0? —
      Owner: Clarence. — Proposed default: alternative 3, adjusted by Step 0.
