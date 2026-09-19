ALTER TABLE "applications" RENAME COLUMN "user_id" TO "profile_id";--> statement-breakpoint
ALTER TABLE "applications" RENAME COLUMN "registration_name" TO "first_name";--> statement-breakpoint
ALTER TABLE "applications" DROP CONSTRAINT "applications_user_id_profiles_id_fk";
--> statement-breakpoint
DROP INDEX "unique_user_batch_application_idx";--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "first_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "father_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "father_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "grandfather_name" text;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_profile_batch_application_idx" ON "applications" USING btree ("profile_id","batch_id");--> statement-breakpoint
CREATE INDEX "applications_profile_id_idx" ON "applications" USING btree ("profile_id");