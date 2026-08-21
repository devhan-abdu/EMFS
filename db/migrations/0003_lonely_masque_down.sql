-- Down-migration for 0003_lonely_masque
-- Reverses: CREATE pacing_type enum, CREATE batch_pacing_offsets table,
--           ADD start_date + pacing_type columns to batches
--
-- Backfill / data safety analysis:
--   1. start_date and pacing_type are nullable columns added to batches.
--      Existing batch rows received NULL for both. Rolling back removes these
--      columns; any schedule data (start_date / pacing_type) that was
--      subsequently set on existing or new batches will be lost. This is
--      expected on rollback — the feature is being reverted.
--   2. batch_pacing_offsets is a brand-new table introduced by this migration.
--      It starts empty and accumulates offset rows only after the migration is
--      applied. Dropping it on rollback destroys any offset data that was
--      entered. This is expected — the feature is being reverted.
--   3. No other table references batch_pacing_offsets (verified by reading all
--      schema files). The only FKs are inbound: batch_id → batches.id (cascade)
--      and editor_id → profiles.id. Dropping the table breaks nothing else.
--   4. The pacing_type enum type must be dropped AFTER the pacing_type column
--      is removed from batches (cannot drop a type that is still in use).
--
-- Drop order: batch_pacing_offsets table → batches columns → enum type.

DROP TABLE IF EXISTS "batch_pacing_offsets";--> statement-breakpoint
ALTER TABLE "batches" DROP COLUMN IF EXISTS "pacing_type";--> statement-breakpoint
ALTER TABLE "batches" DROP COLUMN IF EXISTS "start_date";--> statement-breakpoint
DROP TYPE IF EXISTS "pacing_type";
