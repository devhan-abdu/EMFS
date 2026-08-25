# EMFS Book Shelf

EMFS Book Shelf is a mobile-first reading-group web app built with `Next.js`,
`TypeScript`, `pnpm`, `PostgreSQL`, `Drizzle`, and `Better Auth`.

This README is the beginner-friendly quick start for running the project
locally. For the full doc set, start with [`docs/README.md`](./docs/README.md).

## Prerequisites

Install these first:

- `Node.js` 20+
- `pnpm` 10+
- `Docker` and `docker compose`

Useful checks:

```bash
node -v
pnpm -v
docker -v
docker compose version
```

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Create your local env file:

```bash
cp .env.example .env
```

3. Start PostgreSQL with Docker:

```bash
pnpm db:up
```

4. Apply database migrations:

```bash
pnpm db:migrate
```

5. Start the app:

```bash
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env` and adjust values for your machine.

Important values:

- `DATABASE_URL`: local PostgreSQL connection string
- `BETTER_AUTH_SECRET`: long random secret for Better Auth
- `BETTER_AUTH_URL`: app URL, usually `http://localhost:3000`

Generate a local secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Docker database

Local PostgreSQL is defined in `docker-compose.yml`.

- Start DB: `pnpm db:up`
- Stop DB: `pnpm db:down`

Docker defaults:

- host: `localhost`
- port: `5432`
- database: `emfs_book_shelf`
- user: `emfs`

If `5432` is already in use, change the port mapping in `docker-compose.yml`
and update `DATABASE_URL` in `.env`.

## Common scripts

- `pnpm dev` - run the Next.js dev server
- `pnpm build` - create a production build
- `pnpm start` - run the production build locally
- `pnpm lint` - run ESLint
- `pnpm db:up` - start PostgreSQL in Docker
- `pnpm db:down` - stop PostgreSQL in Docker
- `pnpm db:generate` - generate a Drizzle migration
- `pnpm db:migrate` - apply migrations

## Typical workflow

For a normal day of development:

1. `pnpm db:up`
2. `pnpm dev`

When schema changes are involved:

1. Edit `db/schema/*`
2. Run `pnpm db:generate`
3. Review the generated SQL
4. Run `pnpm db:migrate`

## Project rules

- Do not push directly to `main` — use a feature branch and open a pull request.
- Use `pnpm` for this repo.
- Do not commit real secrets; commit only `.env.example`.
- Do not change schema without a Drizzle migration.
- Keep business logic in `lib/services`.
- Keep input validation in `lib/validations`.
- Better Auth owns login, session, and password behavior.
- The app owns profile, roles, memberships, and authorization.
- Update docs when code and docs drift.

See [`docs/DEVELOPMENT_RULES.md`](./docs/DEVELOPMENT_RULES.md) for the strict rules.

## Next docs to read

- [`docs/ONBOARDING.md`](./docs/ONBOARDING.md)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/FOLDER_STRUCTURE.md`](./docs/FOLDER_STRUCTURE.md)
- [`docs/requirements/module-map.md`](./docs/requirements/module-map.md)
