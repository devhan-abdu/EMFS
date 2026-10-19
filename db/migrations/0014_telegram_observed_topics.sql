CREATE TYPE "public"."telegram_topic_name_source" AS ENUM('reply', 'created', 'edited');--> statement-breakpoint
CREATE TABLE "telegram_observed_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_chat_id" uuid NOT NULL,
	"message_thread_id" integer NOT NULL,
	"name" text NOT NULL,
	"name_source" "telegram_topic_name_source" NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_observed_topics" ADD CONSTRAINT "telegram_observed_topics_telegram_chat_id_telegram_chats_id_fk" FOREIGN KEY ("telegram_chat_id") REFERENCES "public"."telegram_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_observed_topics_chat_thread_idx" ON "telegram_observed_topics" USING btree ("telegram_chat_id","message_thread_id");