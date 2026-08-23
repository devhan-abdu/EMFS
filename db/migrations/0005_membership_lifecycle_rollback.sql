-- Rollback Migration: 0005_membership_lifecycle_rollback.sql
-- Goal: Safely rollback changes made by 0005_membership_lifecycle_backfill.sql.
--
-- REVERSIBILITY:
-- Restores the original NULL (or pre-migration) end_date for all rows modified by the forward migration
-- using the tracking metadata in '_membership_lifecycle_backfill_backup'.

BEGIN;

-- Step 1: Restore original end_date values from backup table
UPDATE "batch_memberships" bm
SET "end_date" = b.original_end_date
FROM "_membership_lifecycle_backfill_backup" b
WHERE bm.id = b.membership_id;

-- Step 2: Drop backup table only after restoration succeeds
DROP TABLE IF EXISTS "_membership_lifecycle_backfill_backup";

COMMIT;
