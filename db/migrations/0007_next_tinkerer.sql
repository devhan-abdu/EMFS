ALTER TABLE "tasks" DROP CONSTRAINT "tasks_day_number_unique";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_book_day_unique" UNIQUE("book_id","day_number");