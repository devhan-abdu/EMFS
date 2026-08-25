CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"language" text NOT NULL,
	"author" text,
	"cover_url" text,
	"sequence_order" integer NOT NULL,
	"paired_book_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "books_sequence_order_language_unique" UNIQUE("sequence_order","language")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_day_number_unique" UNIQUE("day_number")
);
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_paired_book_id_books_id_fk" FOREIGN KEY ("paired_book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_sequence_order_idx" ON "books" USING btree ("sequence_order");--> statement-breakpoint
CREATE INDEX "books_language_idx" ON "books" USING btree ("language");--> statement-breakpoint
CREATE INDEX "tasks_book_id_idx" ON "tasks" USING btree ("book_id");