---
id: '133'
slug: local-pdf-statement-review
area: feature
status: shipped
author: Codex
created: 2026-10-11
approved: 2026-10-11
shipped: 2026-10-12
impl_pr: https://github.com/cljiahao/fynfo/pull/49
constitution_satisfies: ['§2', '§3', '§4', '§5', '§7.4', '§8.3']
constitution_overrides: []
---

# Local bank PDF extraction and review — bounded079 follow-on

## Problem and authority

The owner requested completion of PDF extraction and explicitly confirmed “Extract expenses from UOB/DBS/HSBC/Citibank PDFs for local review”. This authorizes the feature direction and dependency-independent work. Original079 remains historical draft; this narrower batch adds no saving, database writes or dividend workflow. Exact new-dependency approval remains required by AGENTS §0.4 / Constitution §8.3 before installation.

## Reviewed dependency proposal

On2026-10-11 a public registry-only read confirmed `pdfjs-dist@6.4.299`, Apache-2.0, Node `>=22.13.0 || >=24`,34913648 unpacked bytes, no mandatory runtime dependencies or scripts and one optional `@napi-rs/canvas:^1.0.10`. Registry integrity: `sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==`. Active Node is24.15.0. Source-repository development engines differ from published package metadata; installation must follow/review the published distribution, not conflate the two.

Requested exact footprint: add only the pinned PDF.js runtime dependency in package.json and reviewed pnpm-lock.yaml; add only `@napi-rs/canvas` to pnpm-workspace.yaml `ignoredOptionalDependencies`. Preserve existing exotic-dependency/build-script restrictions and all other dependencies. Install only after that approval. Runtime lazy import with bundled local worker, no CDN/viewer/scripting/annotation/link activation, XFA off. Resource requests must remain local. No remote parser/OCR/AI. Large upstream package adds rendering and decoder/worker surface; unpacked size is not measured browser transfer. Lazy loading and explicit bounds mitigate but do not prove safety/performance.

Primary sources: [registry](https://registry.npmjs.org/pdfjs-dist/6.4.299), [API source](https://raw.githubusercontent.com/mozilla/pdf.js/v6.4.299/src/display/api.js), [security advisories](https://github.com/mozilla/pdf.js/security/advisories), [2026 scripting advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j). The advisory lists6.2.108 as patched and concerns enabled scripting; do not use the viewer/scripting layer or claim vulnerability-free status. Inspect actual built options/request graph before release.

## Recorded implementation paths

New feature `src/features/import-review/{components,lib,types.ts,constants.ts,index.ts}`; expense feature composition/barrel only as needed; synthetic parser/loader/component tests; constructed binary PDF fixtures under existing preparation fixture directory; README and audit/spec updates; approved dependency/config/lockfile paths named above. No page-owned fetching. Existing132 JSON review/product tests, schema/crypto/actions/protected files and parent worktrees remain unchanged.

Asset integration recorded before edits: add `scripts/copy-pdfjs-assets.mjs`, invoke it before existing dev/build commands in package.json, and ignore its generated `/public/pdfjs/` output in .gitignore. The script copies only the pinned distribution worker, cMaps, standard fonts and WASM decoders to a versioned local path; no downloads/credentials during build and no other package/script restrictions change. This avoids committing generated vendor binaries and gives reproducible same-origin resources. Existing install/prepare/hooks remain unchanged.

## Format, review and resource contracts

Generated asset verification follow-on: `.prettierignore` and the existing
`eslint.config.mjs` generated-output ignore list must also name `public/pdfjs/**`.
This scopes application formatting/linting to owned source rather than rewriting
or linting copied, minified vendor distribution code. All source rules, coverage
floors and hooks remain active; asset version/integrity/copy checks remain required.

Text PDFs only; bank identity explicitly selected and detected headers compared where present. Support labels identify constructed tested variants, not every statement/account/product layout. Require explicit statement date range/year evidence; unresolved date/currency/columns remain visible and excluded from ready rows. Reconstruct positioned text into lines, preserve original page/description/amount text. Prefer billed SGD column to foreign original values; no inferred FX or credit sign inversion. Refunds, transfers, repayments, summary/balance lines and dividend credits are not expense candidates. Same date/amount/merchant repeats are possible duplicates requiring review, never silently dropped.

Browser-memory-only editable date/description/category/SGD amount rows alongside source page; mobile Statement/Extracted controls retain row state, source provenance always available. No save/import write action in this batch. File/raw passwords/rows are absent from logs, analytics, storage and server requests. Password-protected documents initially report unsupported/password-required without collecting a password; image-only/unsupported variants fail visibly. Limit10MiB,100pages,2000000 extracted characters,200000 text items,4000000 rendered pixels/page and bounded operation deadlines. Only render active page. Replace/cancel/lock/unmount destroys document/worker, cancels rendering, invalidates late results and releases retained local data. Browser transient memory may survive until GC; no secure-erasure claim.

## Acceptance and release boundary

- Exact dependency/optional treatment approved before install; inspect lockfile for unrelated drift and verify omitted native packages. No hook/config bypass.
- Construct actual binary positioned-text PDF fixtures for four declared synthetic bank variants; compare extraction/classification/provenance with their invented source text. Include wrapped lines, foreign/billed columns, credits, rollover/repeats and unsupported layouts. No confidential statement samples.
- Meaningful unit/component regressions for date/currency/credit/summary/duplicate qualification, edit/provenance/navigation/limits/failure/cancel/stale lifecycle. Actual PDF worker extraction/rendering and browser desktop/mobile/keyboard/network proof required before support claims.
- Full unchanged format/lint/typecheck/test:ci/build/hooks/greenCI, incumbent global/security floors and independent second review; serialized heavy verification remains coordinated with parent. No merge/push authorized in this chat.

## Risk and reversibility

Owner delivery authorization2026-10-12: “implement and PR and merge them once
its clean” authorizes committing, publishing and merging this session's approved
132/133 scope after local gates and CI pass. Final portability correction records
`.gitattributes`: mark only `docs/audit/pdf-import-fixtures/*.pdf` as binary to
prevent Windows newline conversion from corrupting PDF cross-reference offsets.
No fixture content, dependency, protected harness or unrelated feature changes.

Local implementation verification completed2026-10-11: `pnpm check`,149 test
suites /1574 tests with unchanged coverage floors, production build with synthetic
public settings, and actual synthetic browser worker/source/mobile/network checks
passed. Supplemental harness verification found pre-existing manifest drift for
AGENTS.md and next-verify/SKILL.md, unchanged from HEAD. See the scoped audit for
evidence and residual limits. This spec remains approved and unshipped; no CI,
merge or real bank-layout qualification is claimed.

Wrong layout interpretation can suggest wrong expenses; mandatory visible provenance/editing and no writes limit impact. Malicious PDFs can exhaust resources; explicit bounds/worker cleanup/local-only API are required, not a blanket safety guarantee. Revert scoped feature/dependency/config changes to remove review; no financial database mutation exists to undo.

## Owner decision

Resolved2026-10-11: the owner selected “Approve this exact footprint” for pinned pdfjs-dist@6.4.299, package.json/pnpm-lock.yaml and narrowly named @napi-rs/canvas omission in pnpm-workspace.yaml. This approves installation and the local PDF review implementation; no schema/crypto/protected changes or deployment.
