# Architecture

EMFS Book Shelf is a **mobile-first** reading-group tracking **web app** built on
**Next.js 15 App Router**, with **PostgreSQL** as the system of record and
**Better Auth** for sessions.

## Frontends and backend

- **One Next.js application** serves member and admin surfaces via route groups
  (for example `(member)`, `(admin)`, `(auth)`).
- There is **no separate API server**. Reads happen in Server Components /
  `lib/` query helpers. Writes happen through **Server Actions**.
- **PostgreSQL** (Neon or Supabase) is the source of truth for users, batches,
  page-pace groups, daily progress, reflections, attendance, and library data.
- **Drizzle ORM** owns the schema and migrations.
- **Better Auth** owns authentication and sessions; the application owns
  profiles, roles (member / admin), group membership, and attendance rules.
- Shared validation shapes live as **Zod schemas** under `lib/validations`
  (and may later graduate to a small shared package if needed).

> There is no NestJS, no TypeORM, and no tRPC in this project. See
> [Tech Stack](./TECH_STACK.md) and [Folder Structure](./FOLDER_STRUCTURE.md).

## Repo layout (planned)

```txt
EMFS-book-shelf/
  app/                 Next.js App Router (pages, layouts, route handlers)
  components/          UI (shadcn + feature components)
  db/                  Drizzle schema, migrations, client
  lib/                 auth helpers, services, validations, utils
  actions/             Server Actions (thin entry points)
  tests/               Vitest + Playwright (exact layout at scaffold)
  docs/                This documentation
  public/              Static assets
```

Full ownership notes: [Folder Structure](./FOLDER_STRUCTURE.md).

## Runtime boundaries (development)

| Surface | Port / URL | Notes |
| --- | --- | --- |
| Next.js app | `3000` | App Router UI + Server Actions |
| Better Auth | `/api/auth/*` | Mounted via Next.js route handler |
| PostgreSQL | hosted or local | Connection via `DATABASE_URL` |

Exact local ports and scripts are confirmed when the app is scaffolded; keep
`.env.example` as the single env map.

## Request / mutation flow

```txt
UI (Server or Client Component)
  -> Server Action (Zod parse + authz check)
    -> lib/service (workflow + transaction)
      -> db (Drizzle) -> PostgreSQL
```

- **Route handlers** are reserved for Better Auth and any unavoidable webhooks —
  not for ordinary CRUD.
- **Server Actions** map the boundary only: validate input, resolve session,
  call a service, return a typed result (or structured field errors).
- **Services** own workflows and multi-table writes (including attendance side
  effects derived from reflections).
- **Drizzle schema** describes persistence only; business rules stay out of
  table definitions.

## Auth and authorization

1. The user authenticates through **Better Auth** (email/password planned for MVP).
2. The app resolves the linked **app user** (profile + role).
3. Server Actions and protected layouts enforce **role and membership** checks
   (admin vs member; batch/group isolation).
4. Sensitive admin actions should be auditable once an audit table is introduced
   (not required to invent before open decisions settle).

UI role checks (hiding nav items) are **UX only** — every mutation must
authorize on the server.

## Domain shape (from PRD)

- **Batches** isolate cohort ops data
  ([`domain/batch-and-intake.md`](./domain/batch-and-intake.md)).
- Roles: `super_admin` → `batch_admin` (1–3) → `pace_admin` (multi OK) → member
  ([`domain/admin-ops.md`](./domain/admin-ops.md)).
- Pace groups: 5 / 10 / 20 / 40; schedule drives admin daily-task drafts.
- **In-app** groups: pace, announcement, discussion; Telegram optional only
  (`OD-018`).
- MVP spine: register → approve (auto or manual) → bot handoff → daily progress →
  attendance window → review / removal.
- **Membership & moves** (see [`requirements/module-map.md`](./requirements/module-map.md)
  — `US-REG-10` … `US-REG-11`, `US-GRP-08`, `US-ADM-05` … `US-ADM-06`):
  - **Batch removal is the default.** Removing a member from a batch is full
    removal — not an automatic reassignment to a lower/later-starting batch.
  - **Cross-batch reassignment is opt-in and criteria-gated.** A removed member
    may join a later batch only when they meet admin-set criteria **and** then
    either (a) are directly invited by an admin, or (b) re-register through the
    normal application flow. Removal does not guarantee reassignment.
  - **In-batch pace-group moves are separate.** A member may move from one pace
    group to another within the same batch via a normal request/approval flow —
    unrelated to removal or cross-batch reassignment criteria.
  - **History is preserved; moves are auditable.** After any pace-group move or
    batch removal/reassignment, the member's prior attendance, reflections, and
    progress remain intact and viewable (nothing deleted). Admins see a log of
    who moved, from where to where, when, and whether a removed member was ever
    reassigned or left for good.

## Dependency-first delivery order

Foundation first, then MVP features (aligned with PRD milestones):

1. Next.js + TypeScript + Tailwind + shadcn skeleton.
2. Drizzle schema, migrations, `DATABASE_URL` wiring.
3. Better Auth + app-user linking + role model.
4. Registration / batch join + admin approval (FR-4) —
   [`domain/batch-and-intake.md`](./domain/batch-and-intake.md).
5. Daily reading tracking visible to assigned admins (FR-1).
6. Weekly reflection post on Groups page + attendance derivation (FR-2, FR-3) —
   policy in [`domain/reflections.md`](./domain/reflections.md).
7. Basic reading portfolio (FR-5 — basic; not blocking MVP V1 if scoped out).
8. Vitest + Playwright coverage for the spine flow.
9. Vercel deploy + env/secrets hardening.
