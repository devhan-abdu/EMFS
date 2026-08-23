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
ALTER TABLE "handoff_records" ADD CONSTRAINT "handoff_records_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_from_batch_id_batches_id_fk" FOREIGN KEY ("from_batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_to_batch_id_batches_id_fk" FOREIGN KEY ("to_batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_handoff_code_idx" ON "handoff_records" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_handoff_application_idx" ON "handoff_records" USING btree ("application_id");