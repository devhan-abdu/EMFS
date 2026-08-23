-- Migration: 0005_membership_lifecycle_backfill.sql
-- Goal: Data integrity validation and lifecycle backfill for batch_memberships.
--
-- HISTORICAL STATUS MAPPING CONTEXT:
-- In migration 0001 (0001_deep_dragon_man.sql), batch_membership_status was ('active', 'removed', 'completed').
-- In migration 0002 (0002_freezing_ezekiel.sql), the column was transitioned to the canonical 7-state enum:
--   ('waitlisted', 'applied', 'approved', 'rejected', 'active', 'grace', 'removed')
--
-- HISTORICAL CONCEPTUAL MAPPINGS:
-- 1. 'active'    -> 'active'    : Preserved directly in canonical model.
-- 2. 'removed'   -> 'removed'   : Preserved directly in canonical model.
-- 3. 'completed' -> 'removed'   : Conceptually mapped to terminal status 'removed' with cohort completion metadata.
-- 4. 'pending'   -> 'applied'   : Applications awaiting intake decision.
-- 5. 'waitlist'  -> 'waitlisted': Preserved as canonical waitlisted state.
-- 6. 'accepted'  -> 'approved'  : Preserved as canonical approved state awaiting handoff.
--
-- CURRENT DATABASE STATE:
-- Because migration 0002 already enforced public.batch_membership_status, all existing rows
-- in batch_memberships already use the canonical enum values.
--
-- REVERSIBILITY & DATA PRESERVATION:
-- This migration normalizes terminal rows ('removed', 'rejected') that have a NULL end_date by
-- assigning created_at. Before modifying any row, original values are recorded in the dedicated
-- backup table '_membership_lifecycle_backfill_backup' so the rollback migration can restore
-- the original NULL end_date losslessly.

BEGIN;

-- Step 1: Create dedicated backup table for reversible rollback
CREATE TABLE IF NOT EXISTS "_membership_lifecycle_backfill_backup" (
    "membership_id" uuid PRIMARY KEY,
    "original_end_date" timestamp,
    "migrated_at" timestamp DEFAULT now() NOT NULL
);

-- Step 2: Record original values for only the rows that will be modified
INSERT INTO "_membership_lifecycle_backfill_backup" ("membership_id", "original_end_date")
SELECT 
    id,
    end_date
FROM "batch_memberships"
WHERE "status" IN ('removed', 'rejected') AND "end_date" IS NULL
ON CONFLICT ("membership_id") DO NOTHING;

-- Step 3: Normalize terminal status rows ('removed', 'rejected') to have an end_date set if missing
UPDATE "batch_memberships"
SET "end_date" = COALESCE("end_date", "created_at")
WHERE "status" IN ('removed', 'rejected') AND "end_date" IS NULL;

COMMIT;
