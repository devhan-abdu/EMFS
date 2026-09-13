ALTER TABLE "membership_audit_logs" DROP CONSTRAINT "membership_audit_logs_actor_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "membership_audit_logs" ADD CONSTRAINT "membership_audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;