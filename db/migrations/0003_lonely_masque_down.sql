-- Down-migration for 0003_lonely_masque
-- Reverses: CREATE batch_pacing_offsets table,
--           ADD start_date + reading_days_per_week columns to batches
--
-- Backfill / data safety analysis:
--   1. start_date and reading_days_per_week are columns added to batches.
--      start_date is nullable, reading_days_per_week has a default.
--      Existing batch rows received NULL for start_date and default 6 for reading_days_per_week.
--      Rolling back removes these columns; any schedule data that was
--      subsequently set on existing or new batches will be lost. This is
--      expected on rollback — the feature is being reverted.
--   2. batch_pacing_offsets is a brand-new table introduced by this migration.
--      It starts empty and accumulates offset rows only after the migration is
--      applied. Dropping it on rollback destroys any offset data that was
--      entered. This is expected — the feature is being reverted.
--   3. No other table references batch_pacing_offsets (verified by reading all
--      schema files). The only FKs are inbound: batch_id → batches.id (cascade)
--      and editor_id → profiles.id. Dropping the table breaks nothing else.
--
-- Drop order: batch_pacing_offsets table → batches columns.

DROP TABLE IF EXISTS "batch_pacing_offsets";
--> statement-breakpoint
ALTER TABLE "batches" DROP COLUMN IF EXISTS "reading_days_per_week";
--> statement-breakpoint
ALTER TABLE "batches" DROP COLUMN IF EXISTS "start_date";
