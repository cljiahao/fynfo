# Synthetic fixture inventory

All values are invented. No real statement, identity, key or financial record is included. The ticker is an illustrative string, not a trade or recommendation.

- `export-v3-synthetic.json`: source-shaped nine-domain plaintext envelope, including shared expense and scenario revision7. It is intended inspection input, not a restorable backup or product-validation proof.
- `statement-variants.json`: four constructed bank-inspired text layouts with page/line provenance and expected classification. No actual bank-layout, PDF binary extraction or support claim.
- `validation-cases.json`: proposed mutations/expected zero-write outcomes plus future save/restore edge cases. These cases are specifications, not executed assertions or implementation.

Use a copy of the base envelope for each mutation; do not modify the baseline. Build version1/2 fixtures by removing their absent domains as specified. Never insert fixture metadata into the strict Fynfo envelope. Future assertions must inspect actual validator output, not simply compare this expectation file with itself.

Before PDF implementation claims, construct real binary PDFs carrying these invented lines in deliberately varied positioned columns/pages and render/inspect them. Add corrupt, image-only, password, large-page, XFA and resource-limit fixtures after exact dependency approval. PDF.js text item order/coordinates may differ from reading order; text line expectations alone cannot qualify that layer. Keep resource-heavy generation/browser/test runs coordinated with parent-owned verification.

Preparation verification is limited to JSON syntax/domain inventory, referenced page/line bounds and Git diff scope. No imported record was written, and no parser, bank adapter, restore, encryption roundtrip or runtime behavior is claimed as tested.

## Approved implementation verification (2026-10-11)

The paragraphs above record the original preparation boundary. Specs132/133
subsequently received explicit owner approval. Four binary fixtures,
`uob-constructed-statement.pdf`, `dbs-constructed-statement.pdf`,
`hsbc-constructed-statement.pdf` and `citibank-constructed-statement.pdf`, now
contain invented positioned columns for the period2025-12-15–2026-01-14.
Their rendered pages were visually inspected. They are deliberately constructed
variants, not downloaded bank samples or proof of every bank's statement format.

Actual browser PDF.js worker extraction/rendering passed for all four: UOB SGD
12.30/8.20, DBS wrapped15.00/2.40, HSBC excluded transfer200.00/refund5.00 plus
shop9.40, Citibank foreign USD10.00 with billed SGD13.80, excluded card payment,
and shop4.20. Source page/line links and unsaved edits passed on desktop;
mobile switching retained edits, no horizontal dialog overflow was found, and
Escape restored trigger focus after close. The isolated fixture page issued37
same-origin GET requests, no upload requests and no page errors. Worker rendering
was awaited before pixel inspection. This harness used existing Edge and existing
Vite/React/Tailwind tools, no authentication, private env or real statements.

Parser/loader/component tests additionally cover duplicate candidates, impossible
and ambiguous dates, malformed/unsafe amounts, unsupported text, bounded file,
page/text/render resources, password refusal, open deadline, cancellation and late
results. Loader password/limit tests use controlled mocks; no real encrypted,
image-only, XFA or adversarial-document corpus has been qualified. No saving,
restore or encryption roundtrip is implemented or claimed by this batch.
