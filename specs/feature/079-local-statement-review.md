---
id: '079'
slug: local-statement-review
area: feature
status: draft
author: Codex
created: 2026-10-09
approved:
shipped:
impl_pr:
supersedes: fix/022 for this local-only replacement, subject to scoped approval
constitution_satisfies:
  ['§2.1', '§2.2', '§2.3', '§2.4', '§2.5', '§3.1', '§4', '§5', '§7.4', '§8.3']
constitution_overrides: []
---

# Spec079: Local statement extraction with side-by-side review

## Problem

Clarence requested automatic expense extraction with the original statement
beside editable rows, and named UOB, DBS, Citibank and HSBC on2026-10-09.
The current paste workflow has no source document review. Historical fix022
removed server-side statement upload; this proposal retains that privacy boundary
and introduces a separately approved local-only workflow.

## Constitution check

The file and extraction stay in browser memory; only explicitly selected,
reviewed record fields reach existing authenticated/vault-gated encrypted writes
(§2/§5). Thin pages compose features. Client components and a worker are required
for File APIs, local PDF rendering and editing (§2.5). No new schema, crypto,
protected file or financial service-role access. The new runtime dependency needs
scoped approval under §8.3. The feature direction is owner-requested; implementation
and dependency approval are not invented by this draft.

## Solution shape

Affected paths after approval: new `src/features/import-review/{components,hooks,
lib,types.ts,constants.ts,index.ts}`, expense/equity feature compositions and
barrels, synthetic tests, README, package.json and pnpm-lock.yaml. Keep pages thin.
Use named exports and existing UI primitives. No original-file server action.

- Begin with text-based PDF statements. Treat four named banks as adapter targets,
  not verified support claims: document each tested statement variant. Use public
  examples or constructed nonconfidential fixtures; unsupported layouts remain
  visibly unsupported. CSV and screenshot OCR are separate follow-ups.
- Propose pinned `pdfjs-dist@6.4.299`, Apache-2.0, lazily loaded with its local
  worker only when review opens. Registry metadata on2026-10-09 reports Node
  `>=22.13.0 || >=24`, unpacked size34913648bytes and optional `@napi-rs/canvas^1.0.10`.
  Review that optional native dependency and lockfile before installation; do not
  silently expand the approved footprint. No OCR/AI dependency or remote model.
  Measure actual route/worker bundles and extraction timings; package unpacked
  size is not browser transfer size. Preserve initial route budget.
  Proposed footprint: omit optional `@napi-rs/canvas` through the narrowly named
  `ignoredOptionalDependencies` entry in `pnpm-workspace.yaml`; the browser
  workflow uses existing canvas APIs. This configuration change is included in
  the dependency approval request. Retain other optional packages and existing
  build-script restrictions. Do not use a global no-optional installation.
- File selection displays “Processed on this device” with a clear no-file-storage
  contract. Local PDF passwords, if supported, stay in memory and never appear in
  logs, persistence, analytics or server requests. The agent never accesses real
  statements/passwords; all development fixtures are synthetic.
- Limit to10MiB,100pages, bounded extracted text and worker deadlines. Render
  only the active page. Cancel/replace/lock/navigation terminates work, clears
  drafts and releases object URLs. Reject corrupt/unsupported files visibly.
  Use the low-level document API with XFA disabled; do not run PDF scripting or viewer code, links or annotations. PDF.js6 removed evaluation support; do not pass the obsolete isEvalSupported option.
  Bundle required resources locally, with no remote asset fallback. Review the
  exact library security options and request graph before implementing.
- Desktop: original PDF/page controls left, editable date/merchant/category/
  billed amount right. Selecting a row focuses its source page and excerpt.
  Mobile: clearly named Statement/Extracted tabs retain selection and edits.
  Required errors, ambiguous dates/currencies and save outcomes stay visible.
  Source descriptions remain available when users rename merchants.
- Extract transaction lines with provenance; exclude headings, summaries and
  balances. Validate actual calendar dates and statement-year rollover. Separate
  debit/credit markers, foreign original values and SGD billed amounts. No
  absolute-value conversion of refunds or assumed exchange rate. Current expense
  model supports positive SGD expenses only: show transfers, repayments, refunds
  and unsupported currencies as excluded/unresolved with reasons.
- Flag suspected duplicates against existing entries; users resolve them before
  saving. Never silently merge/delete a transaction. Inferred categories are
  editable and ambiguity is labelled, without fabricated confidence scores.
- Review does not save automatically. Save selected is explicit; unresolved
  required fields cannot be selected for save. Preserve edits on failures and
  show each outcome. Atomic replacement contract077 has shipped; durable import retry identity remains separate. This draft does not approve another migration or promise transactional batch rollback from current actions.
  Dividend-like credits may be reviewed separately through existing dividend
  components, with explicit ticker matching; no double classification as expense.

## Out of scope

No bank login/sync, remote file upload, original-document storage, unattended
saving, automatic payments, cloud OCR/LLM processing, new refund ledger, schema or
crypto changes. No claim that the old spec's regulatory rationale establishes a
blanket legal rule; this design decision is based on the owner's privacy request.

## Acceptance

- Local file/worker request inspection proves no statement bytes, passwords or
  unselected extracted fields leave the browser. No financial analytics/logging.
- Synthetic bank-variant fixtures include multi-page wrapped descriptions,
  foreign/billed columns, credits, duplicate dates/amounts and year rollover.
- Selection, source page navigation, editing, keyboard/mobile layout, invalid
  rows, cancellation, lock/reset and save failure are verified in a browser.
- Saved records use existing owner/vault/encryption gates. Repeated imports and
  interrupted saves cannot silently create duplicates or claim false success.
- pnpm check, test:ci and build pass in the isolated fixture; all aggregate
  coverage metrics above80% and existing stricter security floors remain.
- Second review, README/comment check, lazy bundle/latency measurements and green
  CI precede PR/merge under existing owner authorization.

## Risk & reversibility

Wrong extraction can create misleading expenses, so provenance and explicit
review are mandatory. Large/malicious PDFs can exhaust resources; enforce limits
and local isolation. Revert code/dependency to remove the workflow; imported rows
remain ordinary records managed through existing UI, with no destructive cleanup.

## Open questions

- Owner: approve exact PDF dependency/lockfile footprint after review; no install
  occurred. Optional native package treatment must be settled before install.
- Bank variants and password-protected/image-only coverage require fixture proof;
  no confidential files are requested. Unsupported variants fail visibly.
- Atomic/retried expense import depends on separately scoped contracts; shipped077 alone does not supply durable import idempotency.

## Research

Exact registry metadata was rechecked on2026-10-10 without installation. The
[v6.4.299 API source](https://raw.githubusercontent.com/mozilla/pdf.js/v6.4.299/src/display/api.js)
accepts local bytes, worker/resource factories, image/canvas limits and XFA
configuration. It has no `isEvalSupported` option; do not copy an obsolete flag
and claim it enforces evaluation protection. The upstream removal is documented
in [Mozilla's update record](https://bugzilla.mozilla.org/show_bug.cgi?id=2029536).
Use the rendering/text API without the scripting/viewer layer and explicitly
disable XFA. Verify the pinned built bundle and local resource request graph
during implementation; this source review is not a malicious-file safety proof.
[pnpm's optional-dependency setting](https://pnpm.io/settings#ignoredoptionaldependencies)
supports the proposed narrowly named omission. No package or lockfile was changed.

[PDF.js browser rendering and workers](https://mozilla.github.io/pdf.js/getting_started/),
[PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html),
[DBS PDF eDocuments](https://www.dbs.com.sg/personal/deposits/bank-with-ease/edocuments),
[Citi eStatements](https://www.citibank.com.sg/personal-banking/online-services/electronic-statements-and-advices),
[HSBC electronic statements](https://www.hsbc.com.sg/ways-to-bank/electronic-statements/).
Public descriptions prove PDF availability, not specific parser layout accuracy.
