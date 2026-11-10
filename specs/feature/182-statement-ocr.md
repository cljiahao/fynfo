---
id: '182'
slug: statement-ocr
area: feature
status: approved # draft | approved | shipped | superseded
author: Claude Code
created: 2026-11-08
approved: 2026-11-09 # YYYY-MM-DD, set on approval
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
  - '§5.3'
  - '§8.3'
constitution_overrides:
  - section: '§4.5'
    reason: 'SOFT. New dependency over 50KB; justified below. The OCR bundle and model files load lazily, only on the OCR path, so initial route JS is unchanged.'
---

# Spec 182: Client-side OCR for image-only statement PDFs

## Problem

HSBC's online-banking statement download is a scanned, image-only PDF: pdf.js
returns zero text items for every page, so `loadLocalStatementPdf`
(`src/features/import-review/lib/local-pdf.ts`) has nothing to parse and the
import fails. Spec 181 left HSBC blocked on a text e-statement the owner cannot
obtain. The owner chose OCR over typing every HSBC row by hand. Any other
scanned statement fails the same way today.

## Constitution check

- Satisfies: `§2.1` (statement images and recognised text stay in the browser
  and are never sent anywhere; only the existing reviewed, encrypted import save
  reaches Supabase), `§2.2` and `§2.3` (saving still uses the existing import
  server action with its guard order), `§2.7` and `§3.4` (named exports,
  kebab-case files), `§3.1` (no stack swap), `§3.2` (no `any`, no inline static
  data, no direct component `fetch`: OCR assets are loaded by the engine from
  `/ocr/` inside a lib module, mirroring pdf.js), `§4.1`/`§4.2` (tests below),
  `§5.3` (no secrets involved), `§8.3` (new dependency escalation: this spec is
  the escalation, see Dependency approval).
- Overrides: `§4.5` SOFT performance budget. tesseract.js plus its WASM core and
  English model exceed 50KB by a wide margin. They are dynamically imported and
  fetched only when a statement has no text layer, so first-load JS per route is
  unchanged (precedent: spec 164 lazy page views, spec 034 lazy motion). The
  build copies assets into gitignored `public/ocr/`, so the repo does not grow.
- `AGENTS.md` §0.4: a new dependency requires owner sign-off. Approving this
  spec is that sign-off for exactly the packages named below and nothing else.
  No `HARD` rule is touched; no governance amendment is needed.

## Solution shape

### Detection

After pdf.js text extraction, a document whose total text item count is zero (or
below a small constant, e.g. fewer than 5 items across all pages) takes the OCR
path. Text PDFs follow today's code unchanged, including their errors.
`STATEMENT_LIMITS` bytes, pages and pixels still bound the OCR path. Text PDFs
keep the 45 s `STATEMENT_LIMITS.deadlineMs`; the OCR path uses a separate
OCR-only deadline of 120 s, held as its own named constant beside
`STATEMENT_LIMITS`.

### OCR engine and hosting

- Candidate dependency: `tesseract.js` 7.0.0 (Apache-2.0, npm unpacked 1.4 MB;
  depends on `tesseract.js-core` 7.0.0, Apache-2.0, 45 MB unpacked on npm because
  it ships several WASM builds, of which the browser loads one). English model:
  `@tesseract.js-data/eng` 1.0.0 (MIT, 13.9 MB unpacked on npm across several
  model variants; one variant is used). Sizes are from npm package metadata; real
  over-the-wire sizes (WASM core and the chosen `eng.traineddata`) are measured
  in the first slice and recorded in the impl PR. Pin exact versions (no `^`),
  matching the pdf.js pin style.
- Self-hosting like pdf.js: a build script (extend or sit beside
  `scripts/copy-pdfjs-assets.mjs`, wired into `dev`, `dev:local` and `build`)
  copies the worker script, the chosen core WASM file(s) and the traineddata into
  `public/ocr/<version>/`, which is gitignored like `/public/pdfjs/`. The loader
  passes explicit `workerPath`, `corePath` and `langPath` pointing at `/ocr/...`,
  with `cacheMethod: 'none'`. No CDN and no outbound request at runtime; the
  engine's default jsDelivr/tessdata URLs must never be reachable (verified in
  the Network tab and by the CSP below).
- CSP (`src/lib/csp.ts` builds the per-request policy; `next.config.ts` carries
  only static fallback directives and needs no change): `worker-src 'self' blob:`,
  `connect-src 'self'` and `'wasm-unsafe-eval'` already exist for pdf.js, so no
  directive change is expected. One risk to verify, not assume: the script policy
  uses `'strict-dynamic'`, which ignores `'self'` for scripts a worker pulls in
  with `importScripts`. tesseract.js defaults to a blob-URL worker that imports
  its script and core; set `workerBlobURL: false` so the worker loads directly
  from `/ocr/` like the pdf.js module worker. If a header change still proves
  necessary, it is made in `src/lib/csp.ts` and listed in the impl PR.
- Lazy load: the OCR module (`src/features/import-review/lib/statement-ocr.ts`)
  is reached only through `await import('tesseract.js')` inside the OCR branch.
  Page rendering reuses the pdf.js canvas render already in `local-pdf.ts` at a
  fixed OCR scale (about 300 dpi, capped by `STATEMENT_LIMITS.pixels`). One
  worker, pages recognised sequentially, worker terminated on completion,
  failure or abort (reuse the existing `dispose` and abort handling). Progress
  ("Reading page 2 of 4") goes through the existing import progress state.

### From OCR words to layout input

Tesseract returns words with pixel bounding boxes and a 0-100 confidence. A
pure function in `src/features/import-review/lib/statement-ocr-items.ts` maps
each word to the existing `PositionedStatementText` shape (`text`, `x`, `y`,
`height?`), converting canvas pixels to PDF points: `x = bbox.x0 / scale`,
`y = pageHeight - bbox.y1 / scale` (pdf.js text `y` grows upward and is the
baseline, which the box bottom approximates), `height = (y1 - y0) / scale`.
Words with empty text are dropped. Confidence travels alongside, in a parallel
array or an optional field (decided in the impl; an optional field leaves text
PDFs unaffected). The items then go through the same `positionedStatementLines`
grouping and the spec 181 layout registry as text items, so an HSBC layout is
one more module in `statement-layouts/`. Spec 181 slice 1 (the registry) is a
prerequisite and lands first.

### Accuracy guards

OCR will misread digits, so wrong numbers must not save silently.

- Per-row confidence: a row's confidence is the minimum word confidence across
  its date, description and amount words. Rows below a threshold constant of 80
  are flagged in the review UI as "check against statement". Flagged rows start
  unticked, are skipped by "select all", and may be imported only after an
  explicit per-row confirm. The existing
  statement zoom/highlight view (`statement-zoom.ts`) shows the source line, so
  the user compares the image with the parsed value.
- Reconciliation: where a layout exposes a statement total or sub-total, the sum
  of parsed row amounts for that block is compared with it. A mismatch blocks
  the "select all" convenience and shows a visible warning with the difference.
  Layouts without a total skip the check and say so in the warning area.
- The existing review step is unchanged and mandatory. Nothing is saved without
  the user reviewing and confirming, as today. Rows that fail `qualifyRow`
  validation (no valid positive SGD billed amount) stay unresolved; OCR never
  lowers validation.

### Import rate limiting

`insertImportedExpenses` in
`src/features/expenses/actions/import-expense-actions.ts` is the server action
that persists imported statement rows. Checked on `origin/main`: it has no rate
limit today. This spec adds one, per user: 30 calls per 60 seconds (amended
2026-11-10, was 10), key
`statement_import:<userId>`, using `consumeRateLimit` from
`src/integrations/services/security-rpc.ts` (the limiter `src/app/api/vault/route.ts`
uses for vault reset). The check runs after `requireUserId()` and
`getVaultDekSession()` and before any DB access. Over the limit the action does
not throw: it returns a per-row outcome `not_saved` with reason `rate_limited`
for every row, and the client shows "Not saved: too many imports, retry" while
keeping each row retryable. A limiter outage or timeout is logged server-side
and refused the same way (fail closed, nothing written) with reason
`unavailable` ("Not saved: import unavailable, retry"). No Postgres or limiter
detail reaches the client (`AGENTS.md` §4). Constitution: `§2.3` guard order,
`§5.1` (the same abuse protection as the vault PIN/DEK surface); `CONSTITUTION.md`
has no dedicated rate-limit section, so no other section is cited. Raising the
cap later needs a spec amendment.

Amendment note (2026-11-10, owner decision): the limit is 30 calls per 60
seconds per user, and a refused call returns `not_saved` rows with a retry
message instead of throwing, so a refused group is never shown as
`unconfirmed`. The approval status is unchanged.

Amendment note (2026-11-10, owner decision): the Node dump script is
replaced by a development-only in-browser dump page at `/dev/ocr-dump`. The
script only OCRed embedded images and the HSBC statement body is not one, and
the Node canvas binary needed to render pages is blocked by Windows Application
Control; the page reuses the app's own page render, recogniser and line
grouping and adds no dependency. It is a client component (`'use client'`)
because it needs a file input, a canvas and a web worker. Production returns 404. The dump component is exported from the barrel as a development-gated dynamic import so production bundles do not contain it. The approval status is unchanged.

### HSBC layout

No HSBC column positions, header wording or total line are known: no text was
ever extractable. This is a deliberate implementation step, not a guess here:

1. Slice 1 ships the OCR engine plus a development-only dump page
   (`/dev/ocr-dump`, 404 in production) where the owner picks a PDF and sees the
   OCR word boxes from the app's own pipeline. It runs entirely in the browser
   tab: no file is written, no network call carries content, and its output is
   never committed or pasted into the repo. The owner runs it on his real
   statement.
2. The owner inspects that output locally and supplies REDACTED layout notes
   for the HSBC section of spec 181 or this spec: header text,
   column x ranges, date format, credit marker, summary lines, total line. No
   real merchant names, amounts, or card or account numbers are written down.
3. Slice 3 (the second implementation slice) builds `statement-layouts/hsbc.ts`
   from those notes. Fixtures are
   synthetic arrays of OCR-shaped items; no real statement, image or screenshot
   enters the repo (§3.2 no PII test data).

### Tests

- Unit (vitest, node environment): synthetic OCR word arrays (pixel boxes plus
  confidence) through the coordinate mapper, grouping and the layout, into rows.
  Cases: scale conversion, empty words, low-confidence flagging, reconciliation
  match and mismatch, and the detection threshold (a PDF with a few text items
  does not take the OCR path).
- The OCR engine itself is not run in vitest. `statement-ocr.ts` takes the
  recogniser as an injected function; tests pass a stub returning canned word
  arrays, and `tesseract.js` is never imported by tests (the dynamic import
  keeps it out of the test graph). A manual run on the owner's real statement
  covers the real engine.
- Rate limit (regression test): `insertImportedExpenses` calls the limiter, a
  call over the limit returns `not_saved`/`rate_limited` rows and performs no
  insert, and a limiter error or timeout returns `not_saved`/`unavailable`
  (fail closed). The limiter is stubbed. A hook test checks a refused row is
  labelled `not_saved`, not `unconfirmed`, and stays retryable.
- A test that no source file references a CDN OCR URL (jsDelivr, tessdata
  hosts), and that the copy script lists the expected `public/ocr/` files.

## Dependency approval and alternatives

Approval of this spec is the `AGENTS.md` §0.4 approval to add `tesseract.js`
(plus its required `tesseract.js-core`) and `@tesseract.js-data/eng`, pinned
exactly. Alternatives considered:

- Manual entry of HSBC rows: no dependency, but the owner rejected it as too
  laborious; stays as today's fallback.
- Server-side OCR (API route or third-party OCR service): rejected. It sends
  full statement images off the device, against the privacy model behind
  `§2.1`, and Vercel function size, memory and duration limits make a
  Tesseract binary impractical.
- Native canvas/OCR dependencies (`node-canvas`, `sharp`, Tesseract binaries):
  rejected; they are server-side and need native builds the Vercel deployment
  cannot rely on.
- Browser `TextDetector` (Shape Detection API): not widely available and not
  specified for tabular statements; rejected.

## Out of scope

- Languages other than English, handwriting, and rotated or skewed scans (deskew
  is a follow-up if the owner's sample needs it).
- Banks other than HSBC using the OCR path in this spec (the plumbing is
  generic; only the HSBC layout is planned).
- Any server-side processing of statement images; keeping images or recognised
  text anywhere beyond browser memory for the session.
- Auto-detecting the bank, and changes to save flow, merchant rules or
  duplicate logic.
- Committing, attaching or quoting any real statement, image or OCR dump.

## Acceptance

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` green
- [ ] `pnpm test:ci` green; new tests cover the coordinate mapper, confidence
      flagging, reconciliation, detection threshold, the injected-stub OCR path
      and the import rate limit
- [ ] `insertImportedExpenses` is limited to 30 calls per minute per user via
      `consumeRateLimit` (owner approved 2026-11-10); over-limit returns
      `not_saved` rows with a retry message, no DB write (regression test)
- [ ] OCR deadline is 120 s; text PDFs still use 45 s
- [ ] The dump page keeps output in the tab only; no real statement output in the diff
- [ ] `pnpm build` green; `public/ocr/` is generated and gitignored
- [ ] Manual: with DevTools Network open, importing a scanned PDF makes no
      request to any origin but the app's own, and importing a text PDF loads
      nothing under `/ocr/`
- [ ] Manual: no CSP violation in the console during OCR
- [ ] Manual: initial route JS size unchanged (OCR is a separate lazy chunk)
- [ ] Manual (owner): the HSBC statement imports, low-confidence rows are
      flagged, the total reconciles or warns, and nothing saves before review
- [ ] Exactly the approved dependencies added, pinned, with licences recorded in
      the impl PR; no real statement data in the diff
- [ ] Spec hash matches at impl PR time

## Risk & reversibility

- **Blast radius**: the import feature only; text-PDF imports take the unchanged
  branch. Worst case is a wrong OCR digit reaching a saved expense, mitigated by
  confidence flags, reconciliation and the mandatory review step. Dev and build
  gain a copy step and tens of MB of generated assets in `public/`.
- **Reversibility**: a single git revert; no migration, no schema or encrypted
  payload change.
- **Backout plan**: revert the impl commits and run `pnpm install` to drop the
  dependencies; scanned PDFs return to failing with the existing text-PDF error.

## Suggested implementation slices

1. OCR plumbing: dependencies, asset copy script, `.gitignore`, lazy loader,
   detection, pixel-to-PDF mapper, injected-recogniser tests, progress and error
   states, OCR-only 120 s deadline, CSP verification, the local-only OCR dump
   script (stdout only; real statement output never enters the repo), and the
   per-user rate limit on `insertImportedExpenses` with its regression test.
   Measure and record asset sizes.
2. Accuracy guards: per-row confidence flags (threshold 80, flagged rows
   unticked, per-row confirm) and total reconciliation in the review UI.
3. HSBC layout from the redacted notes (blocked until the notes exist), with
   synthetic fixtures; update spec 181's HSBC section and
   `statement-variants.json`; mark shipped.

## Implementation notes

### Slice 2: accuracy guards

- **Scope of the guards**: confidence flags and total reconciliation apply to
  OCR-sourced rows only. A row is OCR-sourced when its lines carry a confidence;
  text-PDF rows never do, so their review looks and behaves as before. The
  existing DBS, Citi, UOB and PayLah layouts are not opted into totals; they
  show the "Total not checked" note on a scan and change nothing on a text PDF.
  The HSBC layout in slice 3 supplies its total through the hook below.
- **Confidence**: a row's confidence is the minimum word confidence across the
  lines that make up the row (date, description and amount words). It is
  optional on `StatementLine` and `StatementCandidate`. The threshold is
  `OCR_CONFIDENCE_THRESHOLD` (80): 79 is flagged, 80 is not. Confidence never
  changes `qualifyRow` status, so OCR cannot loosen validation.
- **Confirm flow**: a flagged row shows "Check against statement", starts
  unticked, is skipped by select all, and its checkbox stays disabled until the
  user presses "Confirm row matches statement". The existing "Compare source"
  zoom and highlight view is reused. The confirmation is in memory only and is
  cleared on remove and reset. Confidence is stripped before the import payload,
  since `importedExpenseSchema.source` is strict.
- **Layout hook**: `StatementLayout.blockTotals?(lines, claimedPages)` returns
  `{ totalCents, rowStarts }[]`, the printed total of each block and the first
  line of each row it covers. It is optional; a layout without it reports
  nothing to compare.
- **Reconciliation**: computed live from the current rows, so correcting an
  amount re-evaluates it. Equal sums show nothing. A difference shows a warning
  with the statement total, rows total and difference (hidden when amounts are
  hidden) and disables select all, leaving per-row selection. No total shows
  "Total not checked". A row with no amount counts as zero, so an unreadable row
  surfaces as a mismatch.
- **Carried over from slice 1**: OCR output is capped by the share of
  `STATEMENT_LIMITS.textItems` and `characters` that the text layer has not used,
  failing with the existing `Statement text limit` error. The OCR engine's
  `terminate()` runs in `finally` as `void ... .catch(...)`, so a hung shutdown
  cannot hang extraction.
- **Tests**: the OCR engine is never run in vitest; tests use the injected
  recogniser stub and the existing `ocrStatementPages` and `local-pdf` mocks.

## Open questions

- [x] Q: Approve the three named packages as the dependency set? — Owner:
      Clarence — A: Yes. Approved 2026-11-09: `tesseract.js` 7.0.0, `tesseract.js-core` 7.0.0 and `@tesseract.js-data/eng` 1.0.0, pinned exactly (`AGENTS.md` §0.4).
- [x] Q: English model variant (fast, standard or best): size against digit
      accuracy; decided on the owner's real statement in slice 1. — Owner:
      Clarence — A: Decided in slice 1 on the owner's real statement, by digit accuracy against size.
- [x] Q: Does `workerBlobURL: false` satisfy the `'strict-dynamic'` CSP, or is a
      `src/lib/csp.ts` change needed? — Owner: slice 1 builder — A: Resolved by the slice 1 builder, who verifies it and lists any `src/lib/csp.ts` change in the impl PR.
- [x] Q: HSBC column positions, header wording, credit marker and total line are
      unknown; who inspects the local OCR output and writes the redacted notes?
      — Owner: Clarence — A: Slice 1 ships a local-only dev script that prints OCR word boxes (text, x/y, confidence) for a PDF path to stdout. Clarence runs it on his real statement and supplies redacted layout notes; slice 2 writes the HSBC parser and synthetic fixtures from them.
- [x] Q: OCR deadline: 45 s (`STATEMENT_LIMITS.deadlineMs`) may be too short for
      a multi-page statement on a phone; use a separate OCR limit? — Owner:
      Clarence — A: Yes. OCR gets its own 120 s limit; text PDFs keep 45 s.
- [x] Q: Initial low-confidence threshold (80), and may flagged rows be accepted
      after an explicit per-row confirm? — Owner: Clarence — A: Threshold 80. Flagged rows start unticked and may be imported after an explicit per-row confirm.
- [x] Q: Does the HSBC statement print a total or sub-total usable for
      reconciliation? — Owner: Clarence — A: Determined from the redacted notes in slice 2.
