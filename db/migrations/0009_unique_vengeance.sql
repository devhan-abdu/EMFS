CREATE TABLE "batch_daily_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"curriculum_step_id" uuid NOT NULL,
	"scheduled_date" date NOT NULL,
	"batch_day_number" integer NOT NULL,
	"local_caption_override" text,
	"publication_status" "task_publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"published_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "batch_daily_tasks_group_date_unique" UNIQUE("pace_group_id","scheduled_date"),
	CONSTRAINT "batch_daily_tasks_group_day_unique" UNIQUE("pace_group_id","batch_day_number"),
	CONSTRAINT "batch_daily_tasks_group_step_unique" UNIQUE("pace_group_id","curriculum_step_id"),
	CONSTRAINT "batch_daily_tasks_publication_check" CHECK (("batch_daily_tasks"."publication_status" = 'published') = ("batch_daily_tasks"."published_at" IS NOT NULL)),
	CONSTRAINT "batch_daily_tasks_day_number_check" CHECK ("batch_daily_tasks"."batch_day_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "curriculum_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_number" integer NOT NULL,
	"pace_size" integer NOT NULL,
	"step_number" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"caption" text NOT NULL,
	"caption_am" text,
	"image_url" text,
	"created_by" uuid,
	"source_batch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "curriculum_steps_slot_pace_step_version_unique" UNIQUE("slot_number","pace_size","step_number","version"),
	CONSTRAINT "curriculum_steps_pace_size_check" CHECK ("curriculum_steps"."pace_size" IN (5, 10, 20, 40)),
	CONSTRAINT "curriculum_steps_slot_number_check" CHECK ("curriculum_steps"."slot_number" > 0),
	CONSTRAINT "curriculum_steps_step_number_check" CHECK ("curriculum_steps"."step_number" > 0),
	CONSTRAINT "curriculum_steps_version_check" CHECK ("curriculum_steps"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "batch_pacing_offsets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pace_group_cursors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "batch_pacing_offsets" CASCADE;--> statement-breakpoint
DROP TABLE "pace_group_cursors" CASCADE;--> statement-breakpoint
DROP TABLE "daily_tasks" CASCADE;--> statement-breakpoint
DROP TABLE "tasks" CASCADE;--> statement-breakpoint
ALTER TABLE "pace_groups" ADD COLUMN "active_book_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_daily_tasks" ADD CONSTRAINT "batch_daily_tasks_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_daily_tasks" ADD CONSTRAINT "batch_daily_tasks_curriculum_step_id_curriculum_steps_id_fk" FOREIGN KEY ("curriculum_step_id") REFERENCES "public"."curriculum_steps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_daily_tasks" ADD CONSTRAINT "batch_daily_tasks_published_by_profiles_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_steps" ADD CONSTRAINT "curriculum_steps_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_steps" ADD CONSTRAINT "curriculum_steps_source_batch_id_batches_id_fk" FOREIGN KEY ("source_batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "batch_daily_tasks_curriculum_step_id_idx" ON "batch_daily_tasks" USING btree ("curriculum_step_id");--> statement-breakpoint
CREATE INDEX "batch_daily_tasks_publication_status_idx" ON "batch_daily_tasks" USING btree ("publication_status");--> statement-breakpoint
ALTER TABLE "pace_groups" ADD CONSTRAINT "pace_groups_active_book_id_books_id_fk" FOREIGN KEY ("active_book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_task_id_batch_daily_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."batch_daily_tasks"("id") ON DELETE cascade ON UPDATE no action;