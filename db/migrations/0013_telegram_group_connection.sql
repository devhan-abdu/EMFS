CREATE TYPE "public"."telegram_chat_status" AS ENUM('active', 'bot_removed');--> statement-breakpoint
CREATE TYPE "public"."telegram_topic_kind" AS ENUM('pace_group', 'announcement');--> statement-breakpoint
CREATE TABLE "telegram_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" bigint NOT NULL,
	"batch_id" uuid NOT NULL,
	"title" text,
	"is_forum" boolean DEFAULT false NOT NULL,
	"status" "telegram_chat_status" DEFAULT 'active' NOT NULL,
	"can_manage_topics" boolean DEFAULT false NOT NULL,
	"linked_by" uuid,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_chats_chat_id_unique" UNIQUE("chat_id"),
	CONSTRAINT "telegram_chats_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
CREATE TABLE "telegram_chat_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_chat_id" uuid NOT NULL,
	"message_thread_id" integer NOT NULL,
	"kind" "telegram_topic_kind" NOT NULL,
	"pace_group_id" uuid,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_chat_topics_pace_group_id_unique" UNIQUE("pace_group_id"),
	CONSTRAINT "telegram_chat_topics_kind_pace_group_check" CHECK (("telegram_chat_topics"."kind" = 'pace_group') = ("telegram_chat_topics"."pace_group_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "telegram_link_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"batch_id" uuid NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_linked_by_profiles_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_chat_topics" ADD CONSTRAINT "telegram_chat_topics_telegram_chat_id_telegram_chats_id_fk" FOREIGN KEY ("telegram_chat_id") REFERENCES "public"."telegram_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_chat_topics" ADD CONSTRAINT "telegram_chat_topics_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_chat_topics_chat_thread_idx" ON "telegram_chat_topics" USING btree ("telegram_chat_id","message_thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_chat_topics_one_announcement_idx" ON "telegram_chat_topics" USING btree ("telegram_chat_id") WHERE "telegram_chat_topics"."kind" = 'announcement';--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_link_codes_code_idx" ON "telegram_link_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "telegram_link_codes_batch_idx" ON "telegram_link_codes" USING btree ("batch_id");