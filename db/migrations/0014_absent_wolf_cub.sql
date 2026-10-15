ALTER TABLE "invitations" ADD COLUMN "pace_group_id" uuid;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "pace_duty" "pace_admin_duty";--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_pace_group_id_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."pace_groups"("id") ON DELETE set null ON UPDATE no action;