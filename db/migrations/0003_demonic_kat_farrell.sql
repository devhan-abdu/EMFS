CREATE TYPE "public"."task_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_book_day_unique";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "start_page" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "end_page" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "page_reference" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "status" "task_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "previous_version_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_previous_version_id_tasks_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_book_day_published_unique" ON "tasks" USING btree ("book_id","day_number") WHERE status = 'published';--> statement-breakpoint
CREATE INDEX "tasks_book_status_day_idx" ON "tasks" USING btree ("book_id","status","day_number");--> statement-breakpoint
CREATE INDEX "tasks_previous_version_idx" ON "tasks" USING btree ("previous_version_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_day_number_positive" CHECK ("tasks"."day_number" > 0);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_valid_start_page" CHECK ("tasks"."start_page" IS NULL OR "tasks"."start_page" > 0);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_valid_end_page" CHECK ("tasks"."end_page" IS NULL OR "tasks"."end_page" > 0);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_valid_page_range" CHECK ("tasks"."start_page" IS NULL OR "tasks"."end_page" IS NULL OR "tasks"."end_page" >= "tasks"."start_page");