-- Down-migration for 0002_glossy_nomad
-- Reverses: CREATE books, tasks tables + FKs + indexes
--
-- Backfill / data safety analysis:
--   1. books and tasks are brand-new tables (verified by reading the existing
--      schema barrel and migration journal — neither table existed before this
--      migration). They start empty; there is no catalog data to backfill.
--   2. This migration does NOT touch the batches table — it adds no columns,
--      removes no columns, and changes no constraints. Existing batches (which
--      may be non-empty) are completely unaffected by both the up and down
--      migration.
--   3. No existing table holds a FK to books or tasks (verified by grep across
--      all schema files). The only FKs are self-contained: tasks.book_id → books.id
--      and books.paired_book_id → books.id. Dropping the tables breaks nothing
--      in the existing schema.
--
-- Drop tasks first (FK depends on books), then books.

DROP TABLE IF EXISTS "tasks";--> statement-breakpoint
DROP TABLE IF EXISTS "books";
