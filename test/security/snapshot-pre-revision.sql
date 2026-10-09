-- Seed before spec083 to prove existing records survive the additive DDL.
BEGIN;
INSERT INTO auth.users(id) VALUES('83800000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','83800000-0000-0000-0000-000000000001',true);
SELECT public.replace_asset_snapshot('2025-01',NULL,'pre-revision-parent',
 '[{"id":"pre-revision-child","category":"savings","account":"fixture-opaque-account","amount":"fixture-opaque-amount"}]');
RESET ROLE;
UPDATE public.monthly_snapshots SET created_at='2025-01-01T00:00:00Z',updated_at='2025-01-02T00:00:00Z' WHERE id='pre-revision-parent';
COMMIT;
