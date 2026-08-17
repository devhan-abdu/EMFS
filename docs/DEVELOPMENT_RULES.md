# EMFS Book Shelf Strict Development Rules

This project is production software from the first commit. A build error, type
error, broken deploy, or client/server validation drift is a blocking defect.

This file is the **non-negotiable subset** — the hard merge gates. Detailed
folder ownership and architecture live in
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and
[`FOLDER_STRUCTURE.md`](./FOLDER_STRUCTURE.md). If this file and those docs
disagree, fix the disagreement; do not silently fork a second rule.

Rules marked **(NON-NEGOTIABLE)** are hard gates: code that violates them is
not mergeable, regardless of deadline.

## Non-Negotiable Definition Of Done

A task is not complete unless all required checks pass:

```bash
pnpm verify
```

> Today, `verify` is a documented required gate but is not yet present in
> `package.json`. Until it exists, run the relevant available checks for your
> change and explicitly report what was not run.

No feature, refactor, dependency change, or env/schema change is done until the
relevant verification commands pass.

## Global hard gates

- No known build errors or type errors.
- No `any` / `as any`.
- No duplicated role, status, or route-string constants — define once and import.
- No raw `fetch` to our own backend from components for ordinary mutations;
  use **Server Actions** (or a documented typed client helper if one is added).
- No Prisma; no schema changes without a **Drizzle migration**.
- **(NON-NEGOTIABLE)** No unbounded list UI or query — every collection is
  paginated or explicitly capped with a documented limit.
- **(NON-NEGOTIABLE)** No admin or member screen shipped without a working
  server path (query + action) in the same change.
- **(NON-NEGOTIABLE)** No committed real secret — placeholders only; production
  must fail closed if secrets are missing.
- **(NON-NEGOTIABLE)** No business mutation behind “logged in” alone — checks
  must enforce role and **batch/group membership** (object-level authz).
- **(NON-NEGOTIABLE)** No two-or-more dependent writes outside a single
  database transaction (e.g. reflection submit + attendance mark).

## Required Verification Commands

### Full local verification

```bash
pnpm verify
```

**(NON-NEGOTIABLE)** `verify` is the merge gate and must include lint and
automated tests. A placeholder `test`/`lint` script that only `echo`s is a
failing gate, not a pass.

### Targeted checks (planned)

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test           # Vitest
pnpm test:e2e       # Playwright (needs local/preview app + DB)
```

### What exists today

These scripts are available right now:

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

## Server Actions & application layer

Full layout: [`FOLDER_STRUCTURE.md`](./FOLDER_STRUCTURE.md).

- **Layering:** UI → Server Action → `lib/services` → Drizzle → PostgreSQL.
- Actions are thin: Zod parse, authz, call service, map errors.
- Services own workflows and transactions; schema files describe tables only.
- Prefer Server Components for reads; Client Components only for interactivity
  (forms, toggles, dialogs).
- **(NON-NEGOTIABLE)** Validate every action input with Zod; return structured
  per-field errors (`{ field, message, code }`), never a single opaque string
  for form failures.
- **(NON-NEGOTIABLE)** IDs for “who is acting” come from the session, never
  from a trusted client-supplied user id in the body.

### How to add a Server Action

1. Add or extend a Zod schema in `lib/validations`.
2. Add a failing Vitest test for the service behavior (see [Testing](./TESTING.md)).
3. Implement `lib/services/<feature>.ts`.
4. Add `actions/<feature>.ts` with `"use server"`.
5. Wire the form (React Hook Form + Zod) and map server field errors.
6. Run targeted tests, then `pnpm verify`.

## Persistence (Drizzle)

- Schema lives under `db/schema`; migrations under `db/migrations`.
- **(NON-NEGOTIABLE)** Ship a reversible migration for every production schema
  change; review generated SQL before applying.
- Do not use `drizzle-kit push` as the production change path.
- Money is out of MVP scope; if introduced later, store integer minor units only.
- Soft-delete vs hard-delete policy must be explicit per table — do not mix
  cascade deletes with soft-delete on the same aggregate without a documented
  decision.

## Security & hardening

- **(NON-NEGOTIABLE)** Secrets never committed; env validation fails closed in
  production.
- Commit `.env.example`, never `.env`.
- **(NON-NEGOTIABLE)** Credential endpoints / auth routes are rate-limited once
  available in the Better Auth / platform config.
- Production errors never leak internals; sessions use **HTTP-only cookies**,
  never `localStorage` for tokens.
- Batch isolation: a user in batch A must not read or mutate batch B data
  (see [`domain/batch-and-intake.md`](./domain/batch-and-intake.md)).

## UI (Next.js + shadcn + Tailwind)

- Mobile-first layouts; critical member flows usable on a phone viewport first.
- Forms use React Hook Form + Zod with the grilled field set; no thin
  error-swallowing submit handlers.
- Listing screens show clear empty/loading/error states.
- No inline one-off design systems — reuse `components/ui` and shared patterns.
- Role-gated nav is UX only; server still authorizes.

## Auth model

- Better Auth owns login, logout, sessions, and password hashing.
- The application owns profile, roles (member/admin), group membership, and
  attendance rules — never hand-roll password hashing.
- Middleware is only the first guard. Real authorization must still happen in
  layouts, Server Actions, and services.
- Route visibility is not permission. Every mutation needs server-side authz.

## Testing (NON-NEGOTIABLE)

Full workflow: [Testing](./TESTING.md).

- New services/actions land with Vitest coverage in the same change.
- Spine user flows (register → approve → progress → reflection → attendance)
  get Playwright coverage once the UI exists.
- A placeholder test script counts as a failing gate.

## Review checklist

Before saying work is complete, confirm:

- [ ] `pnpm verify` passes (or documented `Not run - <reason>` only when the
      script does not exist yet during pure docs work).
- [ ] `.env.example` reflects any new required environment variable.
- [ ] No scaffold-only shortcut left behind; skipped checks reported with a reason.
- [ ] If the change touches: a schema → migration reviewed; a mutation → Zod +
      transaction + authz; a new screen → backed by server read/write; a secret →
      placeholder-only, fail-closed; a list → paginated/capped.
- [ ] Story IDs from [module-map.md](./requirements/module-map.md) cited for the
      change; related [Open Decisions](./domain/open-decisions.md) checked — no
      guessing on `Open` items that affect attendance, visibility, registration,
      or batch isolation.
- [ ] [Lifecycles](./domain/lifecycles.md) and
      [roles](./domain/roles-and-permissions.md) respected for any new state or
      permission.

## Stop-The-Line Rule

If any required check fails, stop feature work and fix the failure first. Do
not continue building on top of a broken compile, broken migration, broken auth,
or broken member/admin runtime path.
