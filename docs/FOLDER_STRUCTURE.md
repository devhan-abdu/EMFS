# Folder Structure

Next.js App Router layout for EMFS Book Shelf. These are the expected homes for
code in the current repo — adjust only with a docs update in the same change.

## Top level

```txt
EMFS-book-shelf/
  app/                 Routes, layouts, loading/error UI, auth route handler
  actions/             Server Actions (thin; one concern per file or feature folder)
  components/
    ui/                shadcn primitives (generated / owned copies)
    shared/            Cross-feature UI (empty states, confirm dialogs)
    layout/            Shell, nav, mobile chrome
  db/
    schema/            Drizzle table definitions
    migrations/        Generated SQL migrations
    index.ts           db client export
  lib/
    auth/              Better Auth server/client helpers, session helpers
    services/          Workflows (attendance, reflections, groups)
    validations/       Zod schemas shared by forms + actions
    utils/             cn(), formatting, pure helpers
  hooks/               Client hooks only when needed
  tests/               Unit + e2e (or colocate *.test.ts next to source — pick one at scaffold)
  public/
  docs/                Product + engineering documentation (this tree)
```

## `app/` route groups

```txt
app/
  (auth)/
    login/
    register/
  (member)/
    layout.tsx           Member shell; requires session
    profile/             Profile page — personal reflections + portfolio (author-only)
    groups/              Groups page — pace group feeds; read all, post own group only
    today/               Daily reading mark-done
  (admin)/
    layout.tsx           Admin shell; requires admin role
    members/             Roster + approval queue
    attendance/          Weekly submitted / not-submitted
    groups/              Pace groups + schedules
  (shared)/              Optional: general group / library when scoped
  api/
    auth/[...all]/route.ts   Better Auth handler
  layout.tsx
  page.tsx               Marketing or redirect into app
```

Route groups keep URLs clean while separating member vs admin layouts. Do not
invent deep link contracts for open product questions — see
[Open Decisions](./domain/open-decisions.md).

## `actions/` — how to add a Server Action

```txt
actions/
  daily-progress.ts
  reflections.ts
  membership.ts
  attendance.ts
```

Pattern:

1. `"use server"`
2. Parse input with Zod from `lib/validations`
3. Require session + role/membership
4. Call `lib/services/*`
5. Return `{ ok: true, data }` or `{ ok: false, errors: [{ field, message, code }] }`

Do **not** put SQL or multi-step workflows directly in the action file.

## `db/` — schema and migrations

```txt
db/
  schema/
    users.ts
    groups.ts
    progress.ts
    reflections.ts
    attendance.ts
    index.ts          re-exports
  migrations/
  index.ts            drizzle client
```

- Schema changes go through **Drizzle migrations** (`drizzle-kit generate` →
  review SQL → `migrate`).
- Seeds are separate from migrations (idempotent seed script when introduced).

## Ownership rules

| Kind | Home |
| --- | --- |
| Page / layout | `app/` |
| Mutation entry | `actions/` |
| Business workflow | `lib/services/` |
| Zod input/output | `lib/validations/` |
| Tables / relations | `db/schema/` |
| shadcn primitives | `components/ui/` |
| Feature UI | `components/<feature>/` or colocated under `app/` |

Search these homes before adding a duplicate helper. Full hard gates:
[Development Rules](./DEVELOPMENT_RULES.md).
