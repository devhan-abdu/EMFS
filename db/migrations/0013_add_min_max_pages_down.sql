ALTER TABLE "pace_groups" ADD COLUMN "size" integer;--> statement-breakpoint
UPDATE "pace_groups" SET "size" = "max_pages";--> statement-breakpoint
ALTER TABLE "pace_groups" ALTER COLUMN "size" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pace_groups" DROP CONSTRAINT "pace_groups_min_pages_check";--> statement-breakpoint
ALTER TABLE "pace_groups" DROP CONSTRAINT "pace_groups_max_pages_check";--> statement-breakpoint
ALTER TABLE "pace_groups" DROP COLUMN "max_pages";--> statement-breakpoint
ALTER TABLE "pace_groups" DROP COLUMN "min_pages";
