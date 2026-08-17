# Onboarding

Short path for a new teammate joining **EMFS Book Shelf**.

## What this product is

A mobile-first web app for reading groups: members track daily pages and submit
reflections; admins approve joins and track attendance. Cite scope with stable
`US-*` IDs from the [module map](./requirements/module-map.md). Narrative brief:
[PRD](./PRD.md). Unresolved admin/member questions:
[Open Decisions](./domain/open-decisions.md) — do not invent answers in code.

## Where things live

| Need | Go here |
| --- | --- |
| Product brief (narrative) | [PRD.md](./PRD.md) |
| **Citable stories / modules** | [requirements/module-map.md](./requirements/module-map.md) |
| Open admin/member questions | [domain/open-decisions.md](./domain/open-decisions.md) |
| Glossary / roles / lifecycles / journeys | [domain/](./domain/) |
| Stack choices | [TECH_STACK.md](./TECH_STACK.md) |
| System design | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Folder ownership | [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md) |
| Merge gates / review checklist | [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) |
| How we test | [TESTING.md](./TESTING.md) |
| Docs index | [README.md](./README.md) |

## Get the repo running locally

This project already has the Next.js app scaffolded and uses `pnpm`.

### Prerequisites

Install before you start:

- `Node.js` 20+
- `pnpm` 10+
- `Docker` and `docker compose`

Check your versions:

```bash
node -v
pnpm -v
docker -v
docker compose version
```

### First-time setup

1. Clone the repo and open the project root.
2. Install dependencies:

```bash
pnpm install
```

3. Create your env file:

```bash
cp .env.example .env
```

4. Update `.env` as needed. For local Docker setup, the default
   `DATABASE_URL` from `.env.example` should work as-is.
5. Start PostgreSQL:

```bash
pnpm db:up
```

6. Apply migrations:

```bash
pnpm db:migrate
```

7. Start the app:

```bash
pnpm dev
```

8. Open `http://localhost:3000`.

### Better Auth local setup

Set these in `.env`:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

Local value for `BETTER_AUTH_URL`:

```bash
BETTER_AUTH_URL=http://localhost:3000
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database notes

- Docker runs PostgreSQL 16 on port `5432`.
- Database name: `emfs_book_shelf`
- Username: `emfs`
- Password: `emfs_dev_password`
- Stop the DB with `pnpm db:down`

If you already have PostgreSQL using port `5432`, either stop that service or
change the Docker port mapping and `DATABASE_URL`.

### Current scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm db:up
pnpm db:down
pnpm db:generate
pnpm db:migrate
```

> `pnpm verify`, `pnpm typecheck`, and test scripts are documented as desired
> project gates, but they are not wired into `package.json` yet.

## Working agreements

- Treat this as production software from the first commit.
- Conventional Commits (`feat:`, `fix:`, `docs:`, …); one logical change per
  commit.
- Prefer small, logical commits over one large mixed commit.
- Follow TDD when tests exist for the area ([TESTING.md](./TESTING.md)).
- If a PRD item is ambiguous, add or update an **OD-XXX** row and grill —
  never guess visibility, attendance, or registration policy.
- Code beats stale docs; fix the doc in the same change when they diverge.
- Never commit real secrets, `.env`, or production credentials.
- Use `pnpm`, not `npm` or `yarn`, in this repo.
- Schema changes must include a Drizzle migration.
- AuthN and AuthZ are different: Better Auth handles sign-in/session; app code
  still must enforce role and membership checks.

## First-week reading order

1. [PRD](./PRD.md) (MVP features FR-1–FR-4)
2. [Module Map](./requirements/module-map.md) — cite `US-*` IDs from here on
3. [User Journeys](./domain/user-journeys.md) + [Open Decisions](./domain/open-decisions.md)
4. [Roles](./domain/roles-and-permissions.md) + [Lifecycles](./domain/lifecycles.md)
5. [Architecture](./ARCHITECTURE.md) + [Folder Structure](./FOLDER_STRUCTURE.md)
6. [Development Rules](./DEVELOPMENT_RULES.md)
7. [Testing](./TESTING.md)
