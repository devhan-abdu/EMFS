CREATE TABLE "role_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_profile_id" uuid NOT NULL,
	"actor_profile_id" uuid,
	"previous_role" "role" NOT NULL,
	"new_role" "role" NOT NULL,
	"previous_is_super_admin" boolean DEFAULT false NOT NULL,
	"new_is_super_admin" boolean DEFAULT false NOT NULL,
	"assignment_changes" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "role_audit_logs" ADD CONSTRAINT "role_audit_logs_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_audit_logs" ADD CONSTRAINT "role_audit_logs_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_audit_logs_target_profile_id_idx" ON "role_audit_logs" USING btree ("target_profile_id");--> statement-breakpoint
CREATE INDEX "role_audit_logs_actor_profile_id_idx" ON "role_audit_logs" USING btree ("actor_profile_id");--> statement-breakpoint
CREATE INDEX "role_audit_logs_created_at_idx" ON "role_audit_logs" USING btree ("created_at");