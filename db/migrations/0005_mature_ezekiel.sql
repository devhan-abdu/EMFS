DROP INDEX "waitlist_batch_queue_pos_idx";--> statement-breakpoint
CREATE INDEX "applications_batch_id_idx" ON "applications" USING btree ("batch_id");