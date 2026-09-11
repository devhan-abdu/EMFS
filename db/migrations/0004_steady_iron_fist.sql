ALTER TYPE "public"."task_status" ADD VALUE 'superseded' BEFORE 'archived';--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_day_number_positive";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_valid_start_page";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_valid_end_page";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_valid_page_range";--> statement-breakpoint
DROP INDEX "tasks_book_status_day_idx";