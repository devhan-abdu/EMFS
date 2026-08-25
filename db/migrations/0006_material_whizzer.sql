CREATE TYPE "public"."pace_group_preference" AS ENUM('5', '10', '20', '40');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"registration_name" text NOT NULL,
	"email" text NOT NULL,
	"telegram_username" text NOT NULL,
	"phone_number" text NOT NULL,
	"pace_group" "pace_group_preference" NOT NULL,
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
	"admin_contact_shown" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "membership_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"from_state" "batch_membership_status" NOT NULL,
	"to_state" "batch_membership_status" NOT NULL,
	"from_batch_id" uuid,
	"to_batch_id" uuid,
	"actor_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batch_memberships" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "batch_memberships" ALTER COLUMN "status" SET DEFAULT 'applied'::text;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ALTER COLUMN "from_state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ALTER COLUMN "to_state" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."batch_membership_status";--> statement-breakpoint
CREATE TYPE "public"."batch_membership_status" AS ENUM('waitlisted', 'applied', 'approved', 'rejected', 'active', 'grace', 'removed');--> statement-breakpoint
ALTER TABLE "batch_memberships" ALTER COLUMN "status" SET DEFAULT 'applied'::"public"."batch_membership_status";--> statement-breakpoint
ALTER TABLE "batch_memberships" ALTER COLUMN "status" SET DATA TYPE "public"."batch_membership_status" USING "status"::"public"."batch_membership_status";--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ALTER COLUMN "from_state" SET DATA TYPE "public"."batch_membership_status" USING "from_state"::"public"."batch_membership_status";--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ALTER COLUMN "to_state" SET DATA TYPE "public"."batch_membership_status" USING "to_state"::"public"."batch_membership_status";--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_records" ADD CONSTRAINT "handoff_records_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_from_batch_id_batches_id_fk" FOREIGN KEY ("from_batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_to_batch_id_batches_id_fk" FOREIGN KEY ("to_batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_batch_application_idx" ON "applications" USING btree ("user_id","batch_id");--> statement-breakpoint
CREATE INDEX "applications_batch_id_idx" ON "applications" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_batch_user_waitlist_idx" ON "waitlist" USING btree ("batch_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_batch_queue_pos_idx" ON "waitlist" USING btree ("batch_id","queue_position");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_handoff_code_idx" ON "handoff_records" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_handoff_application_idx" ON "handoff_records" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_batch_membership_idx" ON "batch_memberships" USING btree ("profile_id","batch_id") WHERE status IN ('waitlisted', 'applied', 'approved', 'active', 'grace');