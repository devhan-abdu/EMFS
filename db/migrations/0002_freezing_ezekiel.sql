ALTER TABLE "batch_memberships" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "batch_memberships" ALTER COLUMN "status" SET DEFAULT 'applied'::text;--> statement-breakpoint
DROP TYPE "public"."batch_membership_status";--> statement-breakpoint
CREATE TYPE "public"."batch_membership_status" AS ENUM('waitlisted', 'applied', 'approved', 'rejected', 'active', 'grace', 'removed');--> statement-breakpoint
ALTER TABLE "batch_memberships" ALTER COLUMN "status" SET DEFAULT 'applied'::"public"."batch_membership_status";--> statement-breakpoint
ALTER TABLE "batch_memberships" ALTER COLUMN "status" SET DATA TYPE "public"."batch_membership_status" USING "status"::"public"."batch_membership_status";--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_batch_membership_idx" ON "batch_memberships" USING btree ("profile_id","batch_id") WHERE status IN ('waitlisted', 'applied', 'approved', 'active', 'grace');