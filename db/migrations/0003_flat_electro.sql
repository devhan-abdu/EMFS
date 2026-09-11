CREATE TYPE "public"."daily_progress_status" AS ENUM('done', 'not_done');--> statement-breakpoint
CREATE TABLE "daily_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"status" "daily_progress_status" DEFAULT 'not_done' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_progress_profile_task_unique_idx" ON "daily_progress" USING btree ("profile_id","task_id");--> statement-breakpoint
CREATE INDEX "daily_progress_pace_group_task_idx" ON "daily_progress" USING btree ("pace_group_id","task_id");--> statement-breakpoint
CREATE INDEX "daily_progress_profile_batch_idx" ON "daily_progress" USING btree ("profile_id","batch_id");