# Tech Stack

Chosen stack for EMFS Book Shelf. One line of *why* per choice. Do not add a
competing framework without an explicit dependency review.

| Choice | Why |
| --- | --- |
| **Next.js (App Router)** | Single deployable web app with RSC, Server Actions, and file-based routing — fits a mobile-first product without a separate API service. |
| **TypeScript** | Compile-time contract between UI, actions, and Drizzle schema; blocks `any`-driven drift. |
| **shadcn/ui + Tailwind CSS** | Accessible, copy-owned primitives with utility styling; fast to ship consistent mobile-first UI without a heavy design-system package. |
| **pnpm** | Fast workspace-aware package manager; this repo's scripts and lockfile use pnpm as the standard. |
| **React Hook Form + Zod** | Client forms stay lean; the same Zod schemas validate Server Action inputs so client and server share one validation SSOT. |
| **Drizzle ORM + PostgreSQL** | Typed SQL-first ORM with explicit migrations; PostgreSQL is the durable source of truth for groups, progress, reflections, and attendance. |
| **Docker Compose (local DB)** | Gives beginners a repeatable local PostgreSQL setup without needing a manual database install first. |
| **Neon or Supabase (Postgres host)** | Managed Postgres that pairs with Vercel serverless deploy; pick one hosting target at scaffold time and document it in `.env.example`. |
| **Better Auth** | Session/login/password ownership without hand-rolled auth; app code owns roles (member/admin), groups, and business rules. |
| **Next.js Server Actions** | Mutations live next to the UI with no Nest/tRPC layer to keep in sync; keep actions thin and put workflows in `lib/` services. |
| **Vitest** | Fast unit/integration tests for pure logic, Zod schemas, and service helpers. |
| **Playwright** | End-to-end coverage for register → approve → track → reflect → attendance flows. |
| **Vercel** | Native Next.js hosting, preview deployments, and env management for a web-only MVP. |

## Explicit non-goals (this project)

- No NestJS / separate API server
- No tRPC / GraphQL layer for MVP
- No Prisma
- No Expo / React Native until a future mobile release (see PRD Future Work)
