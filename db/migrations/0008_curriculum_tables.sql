CREATE TABLE "book_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"title" text NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "book_chapters_start_page_check" CHECK ("book_chapters"."start_page" >= 1),
	CONSTRAINT "book_chapters_page_range_check" CHECK ("book_chapters"."end_page" >= "book_chapters"."start_page")
);
--> statement-breakpoint
CREATE TABLE "edition_page_anchors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_book_id" uuid NOT NULL,
	"program_page" integer NOT NULL,
	"edition_page" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "edition_page_anchors_edition_program_page_unique" UNIQUE("edition_book_id","program_page"),
	CONSTRAINT "edition_page_anchors_program_page_check" CHECK ("edition_page_anchors"."program_page" >= 1),
	CONSTRAINT "edition_page_anchors_edition_page_check" CHECK ("edition_page_anchors"."edition_page" >= 1)
);
--> statement-breakpoint
CREATE TABLE "pace_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"pace_size" integer NOT NULL,
	"book_day_number" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"caption" text NOT NULL,
	"caption_am" text,
	"image_url" text,
	"image_public_id" text,
	"created_by" uuid,
	"source_batch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pace_posts_book_pace_day_version_unique" UNIQUE("book_id","pace_size","book_day_number","version"),
	CONSTRAINT "pace_posts_pace_size_check" CHECK ("pace_posts"."pace_size" IN (5, 10, 20, 40))
);
--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP CONSTRAINT "daily_tasks_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "book_day_number" integer NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "scheduled_date" date NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "pace_size" integer NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "paired_book_id" uuid;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "paired_start_page" integer;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "paired_end_page" integer;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "pace_post_id" uuid;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_pace_group_scheduled_date_unique" UNIQUE("pace_group_id","scheduled_date");
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_publication_check" CHECK (("daily_tasks"."publication_status" = 'published') = ("daily_tasks"."published_at" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_pace_size_check" CHECK ("daily_tasks"."pace_size" IN (5, 10, 20, 40));
--> statement-breakpoint
ALTER TABLE "pace_group_cursors" DROP CONSTRAINT "pace_group_cursors_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "pace_group_cursors" ADD CONSTRAINT "pace_group_cursors_current_page_check" CHECK ("pace_group_cursors"."current_page" >= 0);
--> statement-breakpoint
ALTER TABLE "daily_progress" DROP CONSTRAINT "daily_progress_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "book_chapters" ADD CONSTRAINT "book_chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "edition_page_anchors" ADD CONSTRAINT "edition_page_anchors_edition_book_id_books_id_fk" FOREIGN KEY ("edition_book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pace_posts" ADD CONSTRAINT "pace_posts_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pace_posts" ADD CONSTRAINT "pace_posts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pace_posts" ADD CONSTRAINT "pace_posts_source_batch_id_batches_id_fk" FOREIGN KEY ("source_batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_paired_book_id_books_id_fk" FOREIGN KEY ("paired_book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_pace_post_id_pace_posts_id_fk" FOREIGN KEY ("pace_post_id") REFERENCES "public"."pace_posts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_published_by_profiles_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pace_group_cursors" ADD CONSTRAINT "pace_group_cursors_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_task_id_daily_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."daily_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "book_chapters_book_id_start_page_idx" ON "book_chapters" USING btree ("book_id","start_page");
--> statement-breakpoint
CREATE INDEX "edition_page_anchors_edition_book_id_idx" ON "edition_page_anchors" USING btree ("edition_book_id");
--> statement-breakpoint
CREATE INDEX "pace_posts_lookup_idx" ON "pace_posts" USING btree ("book_id","pace_size","book_day_number");
--> statement-breakpoint
CREATE INDEX "daily_tasks_scheduled_date_idx" ON "daily_tasks" USING btree ("scheduled_date");
--> statement-breakpoint
CREATE INDEX "daily_tasks_pace_post_id_idx" ON "daily_tasks" USING btree ("pace_post_id");
--> statement-breakpoint
CREATE INDEX "daily_tasks_paired_book_id_idx" ON "daily_tasks" USING btree ("paired_book_id");
