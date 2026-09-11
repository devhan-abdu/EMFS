-- Down-migration for 0002_huge_brother_voodoo
-- Reverses: CREATE pace_admin_duty enum, CREATE task_publication_status enum,
--           ADD awaiting_placement/assigned to batch_membership_status,
--           CREATE pace_group_cursors table, CREATE pace_admin_assignments table,
--           CREATE membership_move_audit table, CREATE daily_tasks table,
--           ADD batch_id to pace_group_memberships, ADD indexes
--
-- Drop order: indexes → FKs → tables → columns → enums

DROP INDEX IF EXISTS "unique_active_batch_membership_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_group_memberships_status_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_group_memberships_pace_group_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_group_memberships_batch_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_group_memberships_profile_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "unique_active_pace_group_membership_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_groups_batch_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "batch_memberships_status_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "batch_memberships_batch_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "batch_memberships_profile_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "daily_tasks_day_number_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "daily_tasks_publication_status_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "daily_tasks_book_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "daily_tasks_pace_group_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "membership_move_audit_move_date_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "membership_move_audit_to_pace_group_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "membership_move_audit_from_pace_group_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "membership_move_audit_profile_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_admin_assignments_assigned_book_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_admin_assignments_pace_group_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_admin_assignments_profile_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_group_cursors_pace_group_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pace_group_cursors_book_id_idx";
--> statement-breakpoint
ALTER TABLE "pace_group_memberships" DROP CONSTRAINT IF EXISTS "pace_group_memberships_batch_id_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP CONSTRAINT IF EXISTS "daily_tasks_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP CONSTRAINT IF EXISTS "daily_tasks_pace_group_id_pace_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "membership_move_audit" DROP CONSTRAINT IF EXISTS "membership_move_audit_moved_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "membership_move_audit" DROP CONSTRAINT IF EXISTS "membership_move_audit_to_pace_group_id_pace_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "membership_move_audit" DROP CONSTRAINT IF EXISTS "membership_move_audit_from_pace_group_id_pace_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "membership_move_audit" DROP CONSTRAINT IF EXISTS "membership_move_audit_profile_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" DROP CONSTRAINT IF EXISTS "pace_admin_assignments_assigned_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" DROP CONSTRAINT IF EXISTS "pace_admin_assignments_pace_group_id_pace_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" DROP CONSTRAINT IF EXISTS "pace_admin_assignments_profile_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "pace_group_cursors" DROP CONSTRAINT IF EXISTS "pace_group_cursors_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "pace_group_cursors" DROP CONSTRAINT IF EXISTS "pace_group_cursors_pace_group_id_pace_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "pace_group_memberships" DROP COLUMN IF EXISTS "batch_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "daily_tasks";
--> statement-breakpoint
DROP TABLE IF EXISTS "membership_move_audit";
--> statement-breakpoint
DROP TABLE IF EXISTS "pace_admin_assignments";
--> statement-breakpoint
DROP TABLE IF EXISTS "pace_group_cursors";
--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_batch_membership_idx" ON "batch_memberships" USING btree ("profile_id","batch_id") WHERE status IN ('waitlisted', 'applied', 'approved', 'active', 'grace');
--> statement-breakpoint
ALTER TYPE "public"."batch_membership_status" DROP VALUE 'awaiting_placement';
--> statement-breakpoint
ALTER TYPE "public"."batch_membership_status" DROP VALUE 'assigned';
--> statement-breakpoint
DROP TYPE IF EXISTS "pace_admin_duty";
--> statement-breakpoint
DROP TYPE IF EXISTS "task_publication_status";
