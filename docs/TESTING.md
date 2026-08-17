# Testing

This is the canonical TDD workflow for every coding agent and developer working
in EMFS Book Shelf. Other docs link here instead of copying the rules.

## Repo Test Stack (planned)

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit / service | **Vitest** | Zod schemas, pure helpers, `lib/services` workflows |
| End-to-end | **Playwright** | Register → approve → daily progress → reflection → attendance |
| Merge gate | `pnpm verify` | typecheck + lint + Vitest + (when applicable) Playwright |

Do not introduce a second unit or e2e framework without an explicit dependency
review.

> Until the Next.js app is scaffolded, treat this document as the target
> contract. Commands below are the intended names.

## Mandatory TDD Loop

For every new feature or bug fix:

1. Identify the behavior and the owning story id from
   [module-map.md](./requirements/module-map.md) (`US-RDG-01`, …) when product
   scope is involved. Check [Open Decisions](./domain/open-decisions.md) first.
2. Write or update the smallest failing test first.
3. Run the targeted test command and confirm the failure is for the expected
   reason.
4. Implement the smallest production change that makes the test pass.
5. Run the targeted test again.
6. Refactor only after tests are green.
7. Run broader checks when auth, schema, or cross-role workflows are touched.

If a behavior is not practical to unit-test, document the reason and cover it
with the narrowest Playwright, type, or manual check. Do not silently ship
untested behavior.

## Test Placement

- Service / validation behavior: `*.test.ts` next to the source under `lib/`
  (or under `tests/unit` if the scaffold chooses a central folder — pick one
  convention and stick to it).
- Server Action authz and happy-path integration: Vitest with mocked db/session
  boundaries, or a thin integration harness once available.
- Full user journeys and admin attendance visibility: Playwright under
  `tests/e2e` (or `e2e/`).
- UI presentation stays thin; extract testable parsing, mapping, and validation
  into `lib/` helpers.

## Test Shape

- Use Arrange-Act-Assert.
- Name tests by behavior: `methodName scenario expectedResult`.
- Cover happy path, edge/boundary cases, and authz/permission failures.
- Keep tests independent; do not rely on execution order or shared mutable
  state.
- Mock only external boundaries (DB, Better Auth session, email). Prefer real
  Zod schemas and pure functions.
- For persisted fields, prove write and read mapping together.
- For lists, prove pagination/limit behavior when it is part of the feature.
- For batch isolation, prove queries never return another batch’s data
  ([`batch-and-intake.md`](./domain/batch-and-intake.md)). Prove registration
  rejects apply when `registration_open = false`.
- For reflections, prove policy in [`reflections.md`](./domain/reflections.md):
  pace-group post on attendance day counts toward “Submitted”; batch read /
  pace-group-member post rules; personal Profile reflections author-only.

## Agent Checklist

Before modifying code:

- Read [Development Rules](./DEVELOPMENT_RULES.md),
  [Architecture](./ARCHITECTURE.md), and any open decisions for the feature.
- Search for existing tests near the touched code.
- State the targeted test command before editing.

While coding:

- Create or update the failing test first.
- Keep Server Actions thin; put behavior in testable services/helpers.
- Do not use `any`, `as any`, or duplicated status/role strings to make tests
  easier.

Before completion:

- Run the targeted Vitest suite.
- Run `pnpm test` before pushing.
- Run `pnpm verify` before PR when the change crosses auth, schema, or roles.
- Report skipped checks as `Not run - <reason>`.

## Commands (planned)

```bash
pnpm test              # Vitest
pnpm test:watch        # Vitest watch
pnpm test:e2e          # Playwright
pnpm verify            # full gate
```
