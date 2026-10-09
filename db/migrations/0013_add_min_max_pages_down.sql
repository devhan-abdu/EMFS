--> statement-breakpoint
ALTER TABLE "pace_groups" ADD COLUMN "size" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
UPDATE "pace_groups" SET "size" = "max_pages";
--> statement-breakpoint
ALTER TABLE "pace_groups" DROP COLUMN "max_pages";
--> statement-breakpoint
ALTER TABLE "pace_groups" DROP COLUMN "min_pages";
--> statement-breakpoint
ALTER TABLE "pace_groups" DROP CONSTRAINT "pace_groups_min_pages_check";
--> statement-breakpoint
ALTER TABLE "pace_groups" DROP CONSTRAINT "pace_groups_max_pages_check";