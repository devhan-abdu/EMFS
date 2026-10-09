--> statement-breakpoint
ALTER TABLE "pace_groups" ADD COLUMN "min_pages" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "pace_groups" ADD COLUMN "max_pages" integer NOT NULL;
--> statement-breakpoint
UPDATE "pace_groups" SET "max_pages" = "size";
--> statement-breakpoint
ALTER TABLE "pace_groups" ALTER COLUMN "min_pages" SET DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "pace_groups" ADD CONSTRAINT "pace_groups_min_pages_check" CHECK ("min_pages" >= 1);
--> statement-breakpoint
ALTER TABLE "pace_groups" ADD CONSTRAINT "pace_groups_max_pages_check" CHECK ("max_pages" >= "min_pages");
--> statement-breakpoint
ALTER TABLE "pace_groups" DROP COLUMN "size";
--> statement-breakpoint
COMMENT ON COLUMN "pace_groups"."min_pages" IS 'Minimum pages per day for this pace group';
COMMENT ON COLUMN "pace_groups"."max_pages" IS 'Maximum pages per day for this pace group';