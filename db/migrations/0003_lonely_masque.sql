CREATE TYPE "public"."pacing_type" AS ENUM('daily', 'three_times_week', 'custom');--> statement-breakpoint
CREATE TABLE "batch_pacing_offsets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"effective_from_day_number" integer NOT NULL,
	"offset_days" integer NOT NULL,
	"reason" text NOT NULL,
	"editor_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "batch_pacing_offsets_batch_id_effective_from_day_number_unique" UNIQUE("batch_id","effective_from_day_number")
);
--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "pacing_type" "pacing_type";--> statement-breakpoint
ALTER TABLE "batch_pacing_offsets" ADD CONSTRAINT "batch_pacing_offsets_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_pacing_offsets" ADD CONSTRAINT "batch_pacing_offsets_editor_id_profiles_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "batch_pacing_offsets_batch_id_idx" ON "batch_pacing_offsets" USING btree ("batch_id");