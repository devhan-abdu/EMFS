CREATE TABLE "catalog_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_order" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_slots_sequence_order_unique" UNIQUE("sequence_order"),
	CONSTRAINT "catalog_slots_sequence_order_check" CHECK ("catalog_slots"."sequence_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "curriculum_step_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curriculum_step_id" uuid NOT NULL,
	"catalog_slot_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"chapter_label" text,
	"caption" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "curriculum_step_editions_step_book_unique" UNIQUE("curriculum_step_id","book_id"),
	CONSTRAINT "curriculum_step_editions_start_page_check" CHECK ("curriculum_step_editions"."start_page" > 0),
	CONSTRAINT "curriculum_step_editions_page_range_check" CHECK ("curriculum_step_editions"."end_page" >= "curriculum_step_editions"."start_page")
);
--> statement-breakpoint
CREATE TABLE "member_slot_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pace_group_membership_id" uuid NOT NULL,
	"catalog_slot_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "member_slot_editions_membership_slot_unique" UNIQUE("pace_group_membership_id","catalog_slot_id")
);
--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_sequence_order_language_unique";--> statement-breakpoint
ALTER TABLE "curriculum_steps" DROP CONSTRAINT "curriculum_steps_slot_pace_step_version_unique";--> statement-breakpoint
ALTER TABLE "curriculum_steps" DROP CONSTRAINT "curriculum_steps_slot_number_check";--> statement-breakpoint
ALTER TABLE "pace_groups" DROP CONSTRAINT "pace_groups_active_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_paired_book_id_books_id_fk";
--> statement-breakpoint
DROP INDEX "books_sequence_order_idx";--> statement-breakpoint
ALTER TABLE "pace_groups" ADD COLUMN "active_catalog_slot_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "catalog_slot_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_steps" ADD COLUMN "catalog_slot_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_catalog_slot_language_unique" UNIQUE("catalog_slot_id","language");--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_id_catalog_slot_unique" UNIQUE("id","catalog_slot_id");--> statement-breakpoint
ALTER TABLE "curriculum_steps" ADD CONSTRAINT "curriculum_steps_id_slot_unique" UNIQUE("id","catalog_slot_id");--> statement-breakpoint
ALTER TABLE "curriculum_steps" ADD CONSTRAINT "curriculum_steps_slot_pace_step_version_unique" UNIQUE("catalog_slot_id","pace_size","step_number","version");--> statement-breakpoint
ALTER TABLE "curriculum_step_editions" ADD CONSTRAINT "curriculum_step_editions_step_slot_fk" FOREIGN KEY ("curriculum_step_id","catalog_slot_id") REFERENCES "public"."curriculum_steps"("id","catalog_slot_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_step_editions" ADD CONSTRAINT "curriculum_step_editions_book_slot_fk" FOREIGN KEY ("book_id","catalog_slot_id") REFERENCES "public"."books"("id","catalog_slot_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_slot_editions" ADD CONSTRAINT "member_slot_editions_pace_group_membership_id_pace_group_memberships_id_fk" FOREIGN KEY ("pace_group_membership_id") REFERENCES "public"."pace_group_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_slot_editions" ADD CONSTRAINT "member_slot_editions_catalog_slot_id_catalog_slots_id_fk" FOREIGN KEY ("catalog_slot_id") REFERENCES "public"."catalog_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_slot_editions" ADD CONSTRAINT "member_slot_editions_book_slot_fk" FOREIGN KEY ("book_id","catalog_slot_id") REFERENCES "public"."books"("id","catalog_slot_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_slots_archived_idx" ON "catalog_slots" USING btree ("archived");--> statement-breakpoint
CREATE INDEX "curriculum_step_editions_book_id_idx" ON "curriculum_step_editions" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "member_slot_editions_book_id_idx" ON "member_slot_editions" USING btree ("book_id");--> statement-breakpoint
ALTER TABLE "pace_groups" ADD CONSTRAINT "pace_groups_active_catalog_slot_id_catalog_slots_id_fk" FOREIGN KEY ("active_catalog_slot_id") REFERENCES "public"."catalog_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_catalog_slot_id_catalog_slots_id_fk" FOREIGN KEY ("catalog_slot_id") REFERENCES "public"."catalog_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_paired_book_same_slot_fk" FOREIGN KEY ("paired_book_id","catalog_slot_id") REFERENCES "public"."books"("id","catalog_slot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_steps" ADD CONSTRAINT "curriculum_steps_catalog_slot_id_catalog_slots_id_fk" FOREIGN KEY ("catalog_slot_id") REFERENCES "public"."catalog_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_catalog_slot_id_idx" ON "books" USING btree ("catalog_slot_id");--> statement-breakpoint
ALTER TABLE "pace_groups" DROP COLUMN "active_book_id";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "sequence_order";--> statement-breakpoint
ALTER TABLE "curriculum_steps" DROP COLUMN "slot_number";--> statement-breakpoint
ALTER TABLE "curriculum_steps" DROP COLUMN "start_page";--> statement-breakpoint
ALTER TABLE "curriculum_steps" DROP COLUMN "end_page";--> statement-breakpoint
ALTER TABLE "curriculum_steps" DROP COLUMN "caption";--> statement-breakpoint
ALTER TABLE "curriculum_steps" DROP COLUMN "caption_am";--> statement-breakpoint