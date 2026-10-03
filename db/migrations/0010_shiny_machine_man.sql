DROP INDEX "batch_daily_tasks_publication_status_idx";
--> statement-breakpoint
CREATE INDEX "batch_daily_tasks_group_status_day_idx" ON "batch_daily_tasks" USING btree ("pace_group_id", "publication_status", "batch_day_number");