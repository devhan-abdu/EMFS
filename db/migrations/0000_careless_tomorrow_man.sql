CREATE TYPE "public"."role" AS ENUM('super_admin', 'batch_admin', 'pace_admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."pace_admin_duty" AS ENUM('reflection', 'inspiration', 'attendance', 'daily_task');--> statement-breakpoint
CREATE TYPE "public"."batch_membership_status" AS ENUM('waitlisted', 'applied', 'approved', 'rejected', 'active', 'grace', 'removed');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'switched', 'removed');--> statement-breakpoint
CREATE TYPE "public"."task_publication_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."pace_group_preference" AS ENUM('5', '10', '20', '40');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"role" "role" DEFAULT 'member' NOT NULL,
	"first_name" text,
	"father_name" text,
	"grandfather_name" text,
	"telegram_username" text,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"max_members" integer NOT NULL,
	"pace_group_count" integer DEFAULT 1 NOT NULL,
	"registration_open" boolean DEFAULT false NOT NULL,
	"auto_approve" boolean DEFAULT true NOT NULL,
	"start_date" date,
	"reading_days_per_week" integer DEFAULT 6 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "pace_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pace_group_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"current_page" integer DEFAULT 0 NOT NULL,
	"last_advanced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pace_group_book_unique" UNIQUE("pace_group_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "pace_admin_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"duty" "pace_admin_duty" NOT NULL,
	"assigned_book_id" uuid,
	"assigned_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pace_admin_profile_group_duty_unique" UNIQUE("profile_id","pace_group_id","duty")
);
--> statement-breakpoint
CREATE TABLE "batch_admins" (
	"profile_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "batch_admins_profile_id_batch_id_pk" PRIMARY KEY("profile_id","batch_id")
);
--> statement-breakpoint
CREATE TABLE "pace_group_admins" (
	"profile_id" uuid NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pace_group_admins_profile_id_pace_group_id_pk" PRIMARY KEY("profile_id","pace_group_id")
);
--> statement-breakpoint
CREATE TABLE "batch_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"status" "batch_membership_status" DEFAULT 'applied' NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"removal_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pace_group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"switch_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_move_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"from_pace_group_id" uuid,
	"to_pace_group_id" uuid,
	"move_reason" text NOT NULL,
	"moved_by" uuid,
	"move_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pace_group_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"content" text NOT NULL,
	"publication_status" "task_publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"published_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_tasks_pace_group_day_unique" UNIQUE("pace_group_id","day_number"),
	CONSTRAINT "daily_tasks_pace_group_book_page_unique" UNIQUE("pace_group_id","book_id","start_page","end_page")
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"father_name" text NOT NULL,
	"grandfather_name" text,
	"email" text NOT NULL,
	"telegram_username" text NOT NULL,
	"phone_number" text NOT NULL,
	"pace_group" "pace_group_preference",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"queue_position" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handoff_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"code" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp,
	"telegram_chat_id" bigint
);
--> statement-breakpoint
CREATE TABLE "membership_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"from_state" "batch_membership_status" NOT NULL,
	"to_state" "batch_membership_status" NOT NULL,
	"from_batch_id" uuid,
	"to_batch_id" uuid,
	"actor_id" uuid,
	"reason" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"language" text NOT NULL,
	"author" text,
	"cover_url" text,
	"summary" text,
	"page_count" integer,
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
	CONSTRAINT "tasks_book_day_unique" UNIQUE("book_id","day_number")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_pacing_offsets" ADD CONSTRAINT "batch_pacing_offsets_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_pacing_offsets" ADD CONSTRAINT "batch_pacing_offsets_editor_id_profiles_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_groups" ADD CONSTRAINT "pace_groups_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_group_cursors" ADD CONSTRAINT "pace_group_cursors_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_group_cursors" ADD CONSTRAINT "pace_group_cursors_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" ADD CONSTRAINT "pace_admin_assignments_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" ADD CONSTRAINT "pace_admin_assignments_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" ADD CONSTRAINT "pace_admin_assignments_assigned_book_id_books_id_fk" FOREIGN KEY ("assigned_book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_admin_assignments" ADD CONSTRAINT "pace_admin_assignments_assigned_by_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_admins" ADD CONSTRAINT "batch_admins_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_admins" ADD CONSTRAINT "batch_admins_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_group_admins" ADD CONSTRAINT "pace_group_admins_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_group_admins" ADD CONSTRAINT "pace_group_admins_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_memberships" ADD CONSTRAINT "batch_memberships_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_memberships" ADD CONSTRAINT "batch_memberships_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_group_memberships" ADD CONSTRAINT "pace_group_memberships_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_group_memberships" ADD CONSTRAINT "pace_group_memberships_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_group_memberships" ADD CONSTRAINT "pace_group_memberships_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_move_audit" ADD CONSTRAINT "membership_move_audit_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_move_audit" ADD CONSTRAINT "membership_move_audit_from_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("from_pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_move_audit" ADD CONSTRAINT "membership_move_audit_to_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("to_pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_move_audit" ADD CONSTRAINT "membership_move_audit_moved_by_profiles_id_fk" FOREIGN KEY ("moved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_records" ADD CONSTRAINT "handoff_records_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_from_batch_id_batches_id_fk" FOREIGN KEY ("from_batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_to_batch_id_batches_id_fk" FOREIGN KEY ("to_batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_paired_book_id_books_id_fk" FOREIGN KEY ("paired_book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "batch_pacing_offsets_batch_id_idx" ON "batch_pacing_offsets" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "pace_groups_batch_id_idx" ON "pace_groups" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "pace_group_cursors_book_id_idx" ON "pace_group_cursors" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "pace_group_cursors_pace_group_id_idx" ON "pace_group_cursors" USING btree ("pace_group_id");--> statement-breakpoint
CREATE INDEX "pace_admin_assignments_profile_id_idx" ON "pace_admin_assignments" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "pace_admin_assignments_pace_group_id_idx" ON "pace_admin_assignments" USING btree ("pace_group_id");--> statement-breakpoint
CREATE INDEX "pace_admin_assignments_assigned_book_id_idx" ON "pace_admin_assignments" USING btree ("assigned_book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_batch_membership_idx" ON "batch_memberships" USING btree ("profile_id","batch_id") WHERE status IN ('waitlisted', 'applied', 'approved', 'active', 'grace');--> statement-breakpoint
CREATE INDEX "batch_memberships_profile_id_idx" ON "batch_memberships" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "batch_memberships_batch_id_idx" ON "batch_memberships" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "batch_memberships_status_idx" ON "batch_memberships" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_pace_group_membership_idx" ON "pace_group_memberships" USING btree ("profile_id","batch_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "pace_group_memberships_profile_id_idx" ON "pace_group_memberships" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "pace_group_memberships_batch_id_idx" ON "pace_group_memberships" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "pace_group_memberships_pace_group_id_idx" ON "pace_group_memberships" USING btree ("pace_group_id");--> statement-breakpoint
CREATE INDEX "pace_group_memberships_status_idx" ON "pace_group_memberships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "membership_move_audit_profile_id_idx" ON "membership_move_audit" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "membership_move_audit_from_pace_group_id_idx" ON "membership_move_audit" USING btree ("from_pace_group_id");--> statement-breakpoint
CREATE INDEX "membership_move_audit_to_pace_group_id_idx" ON "membership_move_audit" USING btree ("to_pace_group_id");--> statement-breakpoint
CREATE INDEX "membership_move_audit_move_date_idx" ON "membership_move_audit" USING btree ("move_date");--> statement-breakpoint
CREATE INDEX "daily_tasks_pace_group_id_idx" ON "daily_tasks" USING btree ("pace_group_id");--> statement-breakpoint
CREATE INDEX "daily_tasks_book_id_idx" ON "daily_tasks" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "daily_tasks_publication_status_idx" ON "daily_tasks" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "daily_tasks_day_number_idx" ON "daily_tasks" USING btree ("day_number");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_profile_batch_application_idx" ON "applications" USING btree ("profile_id","batch_id");--> statement-breakpoint
CREATE INDEX "applications_batch_id_idx" ON "applications" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "applications_profile_id_idx" ON "applications" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_batch_user_waitlist_idx" ON "waitlist" USING btree ("batch_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_batch_queue_pos_idx" ON "waitlist" USING btree ("batch_id","queue_position");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_handoff_code_idx" ON "handoff_records" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_handoff_application_idx" ON "handoff_records" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "books_sequence_order_idx" ON "books" USING btree ("sequence_order");--> statement-breakpoint
CREATE INDEX "books_language_idx" ON "books" USING btree ("language");--> statement-breakpoint
CREATE INDEX "tasks_book_id_idx" ON "tasks" USING btree ("book_id");