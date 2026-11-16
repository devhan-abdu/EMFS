ALTER TABLE "pace_groups" RENAME COLUMN "size" TO "max_pages";--> statement-breakpoint
ALTER TABLE "pace_groups" ADD COLUMN "min_pages" integer NOT NULL DEFAULT 1;--> statement-breakpoint
UPDATE "pace_groups"
SET
  "min_pages" = GREATEST(
    1,
    LEAST(
      "max_pages",
      CASE
        WHEN "max_pages" <= 5 THEN 5
        WHEN "max_pages" <= 10 THEN 10
        WHEN "max_pages" <= 20 THEN 20
        ELSE 40
      END
    )
  ),
  "max_pages" = CASE
    WHEN "max_pages" <= 5 THEN 5
    WHEN "max_pages" <= 10 THEN 10
    WHEN "max_pages" <= 20 THEN 20
    ELSE 40
  END;