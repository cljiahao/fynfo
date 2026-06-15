------------------------------------------
-- equity_trades: persist CDP + Preferential-Offering flags (spec 044)
-- Non-financial booleans (plaintext, like broker/action). Default false so
-- existing rows are unaffected. Columns inherit the table's existing GRANTs.
------------------------------------------

ALTER TABLE "public"."equity_trades"
  ADD COLUMN "is_cdp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_po"  BOOLEAN NOT NULL DEFAULT false;
