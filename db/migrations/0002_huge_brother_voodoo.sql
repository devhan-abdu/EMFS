CREATE TYPE "public"."pace_admin_duty" AS ENUM('daily_task_check', 'weekly_review', 'progress_monitoring', 'member_support');--> statement-breakpoint
CREATE TYPE "public"."task_publication_status" AS ENUM('draft', 'published');--> statement-breakpoint
ALTER TYPE "public"."batch_membership_status" ADD VALUE 'awaiting_placement' BEFORE 'active';--> statement-breakpoint
ALTER TYPE "public"."batch_membership_status" ADD VALUE 'assigned' BEFORE 'active';--> statement-breakpoint
CREATE TABLE "pace_group_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"current_page" integer DEFAULT 0 NOT NULL,
	"last_advanced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pace_group_book_unique" UNIQUE("pace_group_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "pace_admin_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"duty" "pace_admin_duty" NOT NULL,
	"assigned_book_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pace_admin_profile_group_duty_unique" UNIQUE("profile_id","pace_group_id","duty")
);
--> statement-breakpoint
CREATE TABLE "membership_move_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"from_pace_group_id" uuid,
	"to_pace_group_id" uuid,
	"move_reason" text NOT NULL,
	"moved_by" uuid,
	"move_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"content" text NOT NULL,
	"publication_status" "task_publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"published_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_tasks_pace_group_day_unique" UNIQUE("pace_group_id","day_number"),
	CONSTRAINT "daily_tasks_pace_group_book_page_unique" UNIQUE("pace_group_id","book_id","start_page","end_page")
);
--> statement-breakpoint
DROP INDEX "unique_active_batch_membership_idx";--> statement-breakpoint
ALTER TABLE "pace_group_memberships" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
UPDATE "pace_group_memberships" SET "batch_id" = (SELECT "batch_id" FROM "pace_groups" WHERE "pace_groups"."id" = "pace_group_memberships"."pace_group_id") WHERE "batch_id" IS NULL;--> statement-breakpoint
ALTER TABLE "pace_group_memberships" ALTER COLUMN "batch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pace_group_cursors" ADD CONSTRAINT "pace_group_cursors_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_group_cursors" ADD CONSTRAINT "pace_group_cursors_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" ADD CONSTRAINT "pace_admin_assignments_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" ADD CONSTRAINT "pace_admin_assignments_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" ADD CONSTRAINT "pace_admin_assignments_assigned_book_id_books_id_fk" FOREIGN KEY ("assigned_book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_move_audit" ADD CONSTRAINT "membership_move_audit_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_move_audit" ADD CONSTRAINT "membership_move_audit_from_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("from_pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_move_audit" ADD CONSTRAINT "membership_move_audit_to_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("to_pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_move_audit" ADD CONSTRAINT "membership_move_audit_moved_by_profiles_id_fk" FOREIGN KEY ("moved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pace_group_cursors_book_id_idx" ON "pace_group_cursors" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "pace_group_cursors_pace_group_id_idx" ON "pace_group_cursors" USING btree ("pace_group_id");--> statement-breakpoint
CREATE INDEX "pace_admin_assignments_profile_id_idx" ON "pace_admin_assignments" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "pace_admin_assignments_pace_group_id_idx" ON "pace_admin_assignments" USING btree ("pace_group_id");--> statement-breakpoint
CREATE INDEX "pace_admin_assignments_assigned_book_id_idx" ON "pace_admin_assignments" USING btree ("assigned_book_id");--> statement-breakpoint
CREATE INDEX "membership_move_audit_profile_id_idx" ON "membership_move_audit" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "membership_move_audit_from_pace_group_id_idx" ON "membership_move_audit" USING btree ("from_pace_group_id");--> statement-breakpoint
CREATE INDEX "membership_move_audit_to_pace_group_id_idx" ON "membership_move_audit" USING btree ("to_pace_group_id");--> statement-breakpoint
CREATE INDEX "membership_move_audit_move_date_idx" ON "membership_move_audit" USING btree ("move_date");--> statement-breakpoint
CREATE INDEX "daily_tasks_pace_group_id_idx" ON "daily_tasks" USING btree ("pace_group_id");--> statement-breakpoint
CREATE INDEX "daily_tasks_book_id_idx" ON "daily_tasks" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "daily_tasks_publication_status_idx" ON "daily_tasks" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "daily_tasks_day_number_idx" ON "daily_tasks" USING btree ("day_number");--> statement-breakpoint
ALTER TABLE "pace_group_memberships" ADD CONSTRAINT "pace_group_memberships_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pace_groups_batch_id_idx" ON "pace_groups" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "batch_memberships_profile_id_idx" ON "batch_memberships" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "batch_memberships_batch_id_idx" ON "batch_memberships" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "batch_memberships_status_idx" ON "batch_memberships" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_pace_group_membership_idx" ON "pace_group_memberships" USING btree ("profile_id","batch_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "pace_group_memberships_profile_id_idx" ON "pace_group_memberships" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "pace_group_memberships_batch_id_idx" ON "pace_group_memberships" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "pace_group_memberships_pace_group_id_idx" ON "pace_group_memberships" USING btree ("pace_group_id");--> statement-breakpoint
CREATE INDEX "pace_group_memberships_status_idx" ON "pace_group_memberships" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_batch_membership_idx" ON "batch_memberships" USING btree ("profile_id","batch_id") WHERE status IN ('waitlisted', 'applied', 'approved', 'awaiting_placement', 'assigned', 'active', 'grace');