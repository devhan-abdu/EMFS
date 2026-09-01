# Book catalog, curriculum, and batch pacing

Implementation contract for the **book catalog** (super-admin–managed),
**shared master curriculum**, and **dynamically paced batches**. This document
turns the product objective into a single source of truth for the
implementation team; it does not itself introduce schema or application changes.

Read with: [Data Model](./data-model.md), [Batch & intake](./batch-and-intake.md),
[Admin ops](./admin-ops.md), [Roles & permissions](./roles-and-permissions.md),
and [Architecture](../ARCHITECTURE.md).

## Book catalog (super admin)

The **book catalog** is the global, sequenced library of books the program may
read. Only **`super_admin`** creates or reorders catalog entries.

| Rule | Detail |
| --- | --- |
| Sequence | **`sequence_order` is the program slot** (book 1, book 2, …). The system **auto-assigns** the next slot on “add new book” (`max + 1`). Super admin **never types** a sequence number. Reorder via move up/down (or drag); the system renumbers to keep **contiguous** slots `1..N` with **no gaps**. Amharic + English editions of the **same** title share **one** slot — see [Language editions](#language-editions-am--en). |
| New batch start | Every **new batch always starts at sequence 1** (the first catalog book). Later batches may be on book 3 while an older batch is on book 5 — that is expected. |
| Ownership | Catalog rows have **no** `batch_id`. Batches reference the catalog; they do not copy book content. |
| Metadata | Required: `title`, `sequence_order`, `language` (`en`, `am`, …). Recommended: `cover_url` (file upload), `author`. Super admin types these in the app (`OD-023`). |
| Language editions (Am + En) | Same **program slot**, different `language` rows. Members read **one** edition (Am **or** En), not both. The whole pace group stays on the **same curriculum day** and finishes the slot together. |

### Catalog entry (V1 — decided)

**Manual entry only.** Super admin fills title, language, optional author, and
uploads a cover file. There is **no** ISBN/title lookup against Open Library,
Google Books, or any other provider in V1 (`OD-023`).

Why this is the right V1 cut:

- Catalog writes are rare (a handful of books per year), so typing is not a bottleneck.
- Amharic editions are often missing or incomplete in public book APIs.
- Cover upload is required anyway for local/paired editions.
- An external lookup would add API keys, network failure UX, and delay today's build.

Cover and title appear in member portfolio, admin dashboards, and pace-group
context — store once per catalog row (per language edition).

### Cover upload constraints (V1)

The product docs previously required a cover **file upload** without numeric
limits. These V1 constraints are the citable SSOT for server-side validation
(contents, not filename). They are enforced before object storage.

| Constraint | V1 limit | Why |
| --- | --- | --- |
| Detected types | JPEG, PNG, WebP only | No SVG (scriptable), GIF, BMP, or PDF. Type is sniffed from magic bytes. |
| Max file size | **5 MiB** (`5 × 1024 × 1024` bytes) | Caps upload abuse before decoding. |
| Min dimensions | **200 × 200** pixels | Covers must be usable in portfolio/admin UI. |
| Max dimensions | **4096 × 4096** pixels | Limits decompression-bomb pixel counts. |

Client `Content-Type` and original filename are **not** trusted. A mismatch
between a declared MIME type and the sniffed type is rejected.

Oversized **pixel** dimensions are not a hard reject on the processing path:
inputs that pass type, byte-size, and minimum-dimension checks are **resized
down** (never enlarged) to the max dimensions below. Inputs whose pixel count
exceeds the Sharp decode cap are rejected as unsafe.

### Cover processing (V1)

Applied **after** validation and **before** object storage. Processing is
in-memory (Sharp `Buffer`); uploaded covers are never written to the app
filesystem as durable storage.

| Constraint | V1 limit | Why |
| --- | --- | --- |
| Max **output** dimensions | **4096 × 4096** (`fit: inside`) | Same cap as validation; oversized inputs are scaled down. |
| Enlargement | **Never** (`withoutEnlargement`) | Do not upscale small covers. |
| Output format | **WebP** | Single public-delivery format; smaller than PNG/JPEG at similar quality. |
| WebP quality | **80** | Balance of size vs. catalog-cover fidelity. |
| Max input pixels (decode) | **8192 × 8192** (`67_108_864` px) | Caps decompression bombs; larger headers are rejected without a full decode. |

Processed bytes must still satisfy min dimensions (200×200) and max file size
(5 MiB). If resize would drop a side below 200px, reject the upload.

### Sequence — auto-increment (decided)

**Assign automatically; reorder explicitly; never allow gaps.**

| Action | System behavior |
| --- | --- |
| Add **new program book** | `sequence_order = max(existing slots) + 1` |
| Add **Amharic edition** for an existing English book (or vice versa) | **Same** `sequence_order` as the paired edition — does **not** consume a new slot |
| Reorder | Move whole slot (all editions at that position); renumber affected rows in one transaction |
| Delete | Only if policy allows; then renumber remaining slots to close gaps (`1..N`) |

**Why auto-increment is correct**

- Prevents duplicate numbers and accidental gaps from manual entry.
- “Next book in the program” is always unambiguous.
- Matches a small, curated catalog where order is sacred.

**Tradeoff (acceptable)**

- Inserting a book *between* slot 2 and 3 requires **reorder UI**, not typing `2.5`.
- Deleting a slot requires **renumber** (or soft-delete with renumber) — do not leave hole `1, 2, 4`.

**Constraint (implementation)**

- Uniqueness: `(sequence_order, language)` per edition row — two languages may share slot `1`.
- “Next program book” = next distinct `sequence_order`, not next row id.

### Language editions (Am + En)

Not every member reads English. In one pace group (e.g. 20 members):

- Some read the **Amharic** edition, some the **English** edition.
- It is the **same book** and the **same curriculum day** for everyone.
- Everyone should **finish the slot on the same schedule** (same pace group cursor).

```text
program slot 1 — Atomic Habits
  ├── edition: English  (catalog row, language=en)
  └── edition: Amharic  (catalog row, language=am, same sequence_order)

pace group (20 members)
  ├── member A → English edition → Done = today's En pages
  ├── member B → Amharic edition → Done = today's Am pages
  └── admin today task → ONE post for the group (same day / topic)
```

| Rule | Detail |
| --- | --- |
| Member reads | **One** edition only — chosen at registration or assigned by admin |
| Member Done | Finished **their** edition's pages for today — not both languages |
| Group sync | Same `day_number` / curriculum step; same pace-group page cursor |
| Admin task | **One** daily task per pace group (`OD-015`, `OD-022`) — topics align because curriculum step is shared |
| Catalog link | `paired_book_id` or shared `sequence_order` + opposite `language` |

**Not this:** requiring each member to read both Amharic and English every day.

## Outcome

Every batch follows the same master curriculum in sequence. A batch has its own
relative start date and pace, so two batches can be on different tasks on the
same calendar date without copying books or tasks for either batch.

```text
shared library                         batch configuration
books(sequence_order)                  start_date
  -> tasks(day_number)                 pacing_type + cadence
                                        optional pacing offsets
             \                         /
              \                       /
               dynamic batch state on a requested date
                 -> current task + current book
                 -> next task + next book
```

## Non-Negotiable Rules

1. `books` and `tasks` are master-library rows. They must not contain
   `batch_id`, a static scheduled date, or duplicated copies for a batch.
2. A book's `sequence_order` is its position in the shared library.
3. A task's `day_number` is its relative curriculum step. It is not a calendar
   date, even when the default cadence is daily.
4. A batch owns only scheduling configuration: its `start_date`, `pacing_type`,
   cadence settings, and any schedule exceptions. It never owns curriculum
   content.
5. The same task identifier and book identifier must be returned for every
   batch that is on the same relative step.
6. Pacing may delay or accelerate when configuration permits, but it must never
   reorder tasks or books.

## Target Data Contract

The exact Drizzle names should follow the project conventions, but the
responsibilities below are required.

| Model | Required fields | Ownership and constraint |
| --- | --- | --- |
| `books` | `id`, `title`, `sequence_order`, `language`, `cover_url`, optional `paired_book_id` | Global **catalog**. `(sequence_order, language)` unique. Same `sequence_order` for Am+En editions of one program book. `sequence_order` auto-assigned; contiguous `1..N` per slot. |
| `tasks` | `id`, `book_id`, `day_number`, task content/target | Global library. `book_id` points to a shared book. `day_number` is unique and ascending. |
| `batches` | `start_date`, `pacing_type` | One row per cohort. Existing capacity and registration fields remain. |
| `batch_pacing_offsets` | `batch_id`, `effective_from_day_number`, `offset_days`, reason/audit fields | Optional exception rows; they change dates only and never reference copied task content. |

Recommended batch cadence settings:

| `pacing_type` | Configuration | Meaning |
| --- | --- | --- |
| `daily` | none | One task step per calendar day. |
| `three_times_week` | three ISO weekdays, with a documented default | The next step occurs on each selected weekday. |
| `custom` | one or more ISO weekdays or an explicitly documented repeat pattern | A batch-specific recurring pace. |

Use ISO weekday numbers (`1` Monday through `7` Sunday) if weekdays are stored.
Validate that custom cadence includes at least one valid weekday. Do not use a
JSON blob for task content or duplicate a batch schedule just to encode a
recurring cadence.

## Pacing Calculation

For a batch `B`, task step `n`, and requested calendar date `D`:

```text
base_date(B, 1) = B.start_date
base_date(B, n) = the nth date selected by B's recurring cadence

effective_date(B, n) = base_date(B, n)
                     + sum(offset_days for B's offsets effective at or before n)

current task = highest task day_number n where effective_date(B, n) <= D
next task    = lowest task day_number n where effective_date(B, n) > D
```

Step 1 is active on the batch start date even when that date is not one of the
recurring weekday slots. On a date between two scheduled steps, the previous
task remains the active task. Before the start date, there is no current task
and step 1 is the next task.

Offsets are exceptions, not a second calendar. For example, an offset of `+3`
effective from day 12 pauses every later step by three calendar days. Offset
changes must preserve strictly increasing effective dates; reject a change that
would cause two tasks to reverse or collide unless the product later defines
explicit same-day multi-task behavior.

The calculation must use a single documented product timezone and calendar-date
arithmetic, not elapsed hours. This avoids daylight-saving and server-timezone
drift. The product timezone remains a configuration decision; do not silently
use the database server timezone.

## Dynamic Batch State

The service boundary should be a helper equivalent to:

```ts
getBatchCurrentTask(batchId: string, date: Date): Promise<BatchScheduleState>
```

It must read the batch configuration and the master library, then return this
shape (field names may vary):

```text
BatchScheduleState
  batch: { id, startDate, pacingType, ... }
  currentTask: { task, effectiveDate } | null
  currentBook: book | null
  nextTask: { task, effectiveDate } | null
  nextBook: book | null
```

`currentBook` is the book linked to `currentTask`. `nextBook` is the first book
after `currentBook.sequence_order`; before a batch begins it is the first book
in the library. The state should make an empty or exhausted curriculum explicit
instead of inventing a task.

Keep the calculation in `lib/services`, with pure date/cadence functions covered
by unit tests. The helper is the one place allowed to turn relative library
steps into batch calendar dates.

## Today's task — system draft, admin edit (no cross-batch bleed)

**Problem:** Batch A’s pace admin adjusts today’s pages. Batch B must not change.
**Solution:** three layers — only the bottom layer is editable per batch/group.

```text
master library (shared, super-admin content)
  book + curriculum day step + post-library content
        │
        ▼
batch schedule state (per batch, computed)
  which curriculum step is “today” for this batch’s start_date + cadence + offsets
        │
        ▼
pace-group daily draft (per batch + pace group)
  page target for 5 / 10 / 20 / 40 + optional admin +/- for THIS group only
```

| Layer | Who owns it | Editable by pace admin? |
| --- | --- | --- |
| Catalog books + curriculum tasks | `super_admin` | No |
| Batch calendar position (which step is today) | System from batch config + offsets | Batch admin may add pacing offsets; not content |
| Today’s page target draft | System per **pace group** | Yes — approve, +/- pages; advances **this group’s** page cursor only |

- **Same calendar date, two batches:** both resolve the **same master task id**
  when on the same relative curriculum step; effective calendar dates differ by
  `start_date` / cadence.
- **Same batch, two pace groups (5 vs 20 pages):** same curriculum step and book;
  **different page targets** from each group’s pace (5/10/20/40) and page cursor.
- **Admin edit** writes a **batch + pace_group + date** override (or updates that
  group’s cursor). It must **never** update master `tasks` / `books` rows.

Prepared reflection/inspiration/attendance text may still be **forwarded from the
post library** (`OD-022`) into a pace group without duplicating master curriculum.

## Admin Read Flow

The admin dashboard must select or receive a `batch_id` (and pace group when
applicable) and display only the dynamic state for that scope:

1. Today's active task and its current book.
2. The pace-group page target draft (if pace admin).
3. The next upcoming task and its effective date.
4. The next book in the shared-library queue.

The batch filter is an authorization boundary, not just a UI convenience. A
super admin can query any batch. A batch admin may query only assigned batches.
A pace admin may query only batches reached through their assigned pace groups.
Member-facing reads follow active membership and batch isolation rules.

Use the app's server read path (Server Component plus service) for the dashboard
unless an external consumer genuinely requires a route handler. Any route
handler must accept `batch_id`, validate the optional requested date, and apply
the same object-level authorization before returning state.

## Migration Plan

1. Inventory current book/task tables and identify every static calendar-date
   field and every batch-owned content copy.
2. Create or adapt the global `books` and `tasks` tables with relative indices.
   Preserve identifiers where feasible so existing references remain valid.
3. Add `start_date` and `pacing_type` to `batches`; define an explicit backfill
   policy for existing batches before making `start_date` non-null.
4. Move date exceptions into `batch_pacing_offsets`, retaining audit reason and
   editor information where the current data supports it.
5. Backfill master-library sequence numbers and validate uniqueness, task order,
   and book references before removing old static date fields.
6. Deploy the pacing service and admin read path behind the same data contract.
7. Only after parity checks pass, remove old batch-owned content copies and
   static scheduling columns in a separate reversible migration.

Never make a migration assume that existing batches are empty. A migration must
either backfill a defensible start date, keep the column temporarily nullable
with an operational remediation path, or stop for an explicit product decision.

## Required Tests

- Daily, three-times-weekly, and custom cadence date calculations.
- A batch before start, on start, on an unscheduled day, and after the final
  library task.
- Positive offsets, multiple cumulative offsets, and rejected non-monotonic
  offset changes.
- Two batches with distinct start dates resolving the same master task at
  different calendar dates.
- No duplicate books/tasks created when a second batch is configured.
- Admin `batch_id` filtering and denial of unauthorized batch reads.

## Delivery Checklist

- [ ] Drizzle schema and reviewed reversible migration follow this contract.
- [ ] Zod validates batch pacing configuration and any offset mutation.
- [ ] Service contains the dynamic state helper and has unit coverage.
- [ ] Admin dashboard reads dynamic state with authorized `batch_id` filtering.
- [ ] Existing static-date schedule paths are removed only after migration
      parity checks.
- [ ] Relevant domain docs, module map, and API/UI contracts are updated in the
      same implementation change.
